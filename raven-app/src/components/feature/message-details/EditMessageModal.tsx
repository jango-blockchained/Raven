import { Box, Button, ButtonGroup, HStack, IconButton, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Popover, PopoverContent, PopoverTrigger, Stack, useColorMode, useDisclosure, useToast } from "@chakra-ui/react"
import EmojiPicker, { EmojiClickData } from "emoji-picker-react"
import { useFrappeGetCall, useFrappeUpdateDoc } from "frappe-react-sdk"
import { useCallback, useContext, useEffect, useState } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { FaRegSmile } from "react-icons/fa"
import ReactQuill from "react-quill"
import { AlertBanner } from "../../layout/AlertBanner"
import { ChannelContext } from "../../../utils/channel/ChannelProvider"
import { ChannelData } from "../../../types/Channel/Channel"
import { ModalTypes, useModalManager } from "../../../hooks/useModalManager"

interface EditMessageModalProps {
    isOpen: boolean,
    onClose: (refresh?: boolean) => void,
    channelMessageID: string,
    originalText: string
}

export const EditMessageModal = ({ isOpen, onClose, channelMessageID, originalText }: EditMessageModalProps) => {

    const { users } = useContext(ChannelContext)
    const { data: channelList, error: channelListError } = useFrappeGetCall<{ message: ChannelData[] }>("raven.raven_channel_management.doctype.raven_channel.raven_channel.get_channel_list", undefined, undefined, {
        revalidateOnFocus: false
    })

    const allUsers = Object.values(users).map((user) => {
        return {
            id: user.name,
            value: user.full_name
        }
    })

    const allChannels = channelList?.message.map((channel: ChannelData) => {
        return {
            id: channel.name,
            value: channel.channel_name
        }
    })

    const toast = useToast()
    const { updateDoc, error, loading, reset } = useFrappeUpdateDoc()

    useEffect(() => {
        reset()
    }, [isOpen, reset])

    const [text, setText] = useState(originalText)

    const handleChange = (value: string) => {
        setText(value)
    }

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            onSubmit();
        }
    }

    useHotkeys('enter', () => onSubmit(), {
        enabled: isOpen,
        preventDefault: true,
        enableOnFormTags: true,
    })

    const onSubmit = () => {
        updateDoc('Raven Message', channelMessageID,
            { text: text }).then(() => {
                onClose(true)
                toast({
                    title: "Message updated",
                    description: "Your message has been updated",
                    status: "success",
                    duration: 3000,
                    isClosable: true
                })
            }).catch((e) => {
                toast({
                    title: "Error",
                    description: e.message,
                    status: "error",
                    duration: 3000,
                    isClosable: true
                })
            })
    }

    const handleClose = (refresh: boolean = false) => {
        reset()
        onClose(refresh)
    }

    const mention = {
        allowedChars: /^[A-Za-z\sÅÄÖåäö]*$/,
        mentionDenotationChars: ["@", "#"],
        source: useCallback((searchTerm: string, renderList: any, mentionChar: string) => {

            let values;

            if (mentionChar === "@") {
                values = allUsers;
            } else {
                values = allChannels;
            }

            if (searchTerm.length === 0) {
                renderList(values, searchTerm);
            } else {
                const matches = [];
                if (values)
                    for (let i = 0; i < values.length; i++)
                        if (
                            ~values[i].value.toLowerCase().indexOf(searchTerm.toLowerCase())
                        )
                            matches.push(values[i]);
                renderList(matches, searchTerm);
            }
        }, [])
    }

    const formats = [
        'bold', 'italic', 'underline', 'strike', 'blockquote',
        'list', 'bullet',
        'link', 'mention',
        'code-block'
    ]

    const { colorMode } = useColorMode()

    const modalManager = useModalManager()

    const onEmojiPickerOpen = () => {
        modalManager.openModal(ModalTypes.EmojiPicker)
    }

    const onEmojiClick = (emojiObject: EmojiClickData) => {
        // remove html tags from text but do not remove span with class mention
        const textWithoutHTML = text.replace(/<(?!\/?span)[^>]+>/gi, "")
        // add emoji to text
        const newText = `${textWithoutHTML} ${emojiObject.emoji}`
        // set text
        setText(newText)
        modalManager.closeModal()
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} size={'4xl'}>
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>Edit Message</ModalHeader>
                <ModalCloseButton />

                <ModalBody>
                    <Box>
                        {error && <AlertBanner status='error' heading={error.message}>{error.httpStatus} - {error.httpStatusText}</AlertBanner>}
                        <Stack border='1px' borderColor={'gray.500'} rounded='lg' maxH='40vh' boxShadow='base' bg={colorMode === "light" ? "white" : "gray.800"} overflowY={'scroll'}>
                            <ReactQuill
                                className={colorMode === 'light' ? 'my-quill-editor light-theme' : 'my-quill-editor dark-theme'}
                                onChange={handleChange}
                                value={text}
                                modules={{
                                    toolbar: [
                                        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                        ['link', 'code-block']
                                    ],
                                    mention
                                }}
                                formats={formats}
                                onKeyDown={handleKeyDown} />
                            <HStack w='full' justify={'space-between'} px='2' pb='2'>
                                <Box>
                                    <Popover
                                        isOpen={modalManager.modalType === ModalTypes.EmojiPicker}
                                        onClose={modalManager.closeModal}
                                        placement='top-end'
                                        isLazy
                                        lazyBehavior="unmount"
                                        gutter={48}
                                        closeOnBlur={false}>
                                        <PopoverTrigger>
                                            <IconButton size='xs' variant='ghost' aria-label={"pick emoji"} icon={<FaRegSmile fontSize='1.0rem' />} onClick={onEmojiPickerOpen} />
                                        </PopoverTrigger>
                                        <PopoverContent>
                                            <EmojiPicker onEmojiClick={onEmojiClick} lazyLoadEmojis />
                                        </PopoverContent>
                                    </Popover>
                                </Box>
                            </HStack>
                        </Stack>
                    </Box>

                </ModalBody>

                <ModalFooter>
                    <ButtonGroup>
                        <Button variant='ghost' onClick={() => handleClose()} isDisabled={loading}>Cancel</Button>
                        <Button colorScheme='blue' type='submit' isLoading={loading} onClick={onSubmit}>Update</Button>
                    </ButtonGroup>
                </ModalFooter>

            </ModalContent>
        </Modal>
    )
}