import { getFileName } from '@/utils/operations'
import { ImageMessage } from '../../../../../../../types/Messaging/Message'
import { Box, Button, Dialog, Flex, IconButton, Link, Text } from '@radix-ui/themes'
import { Suspense, lazy, memo, useState, useRef, useEffect } from 'react'
import { DIALOG_CONTENT_CLASS } from '@/utils/layout/dialog'
import { BiDownload, BiChevronDown, BiChevronRight } from 'react-icons/bi'
import { UserFields } from '@/utils/users/UserListProvider'
import { DateMonthAtHourMinuteAmPm } from '@/utils/dateConversions'
import { clsx } from 'clsx'
import { useIsDesktop, useIsMobile } from '@/hooks/useMediaQuery'

const ImageViewer = lazy(() => import('@/components/common/ImageViewer'))

interface ImageMessageProps {
    message: ImageMessage,
    user?: UserFields,
    // Do not load image when scrolling
    isScrolling?: boolean
}

export const ImageMessageBlock = memo(({ message, isScrolling = false, user }: ImageMessageProps) => {

    const [isOpen, setIsOpen] = useState(false)
    // Show skeleton loader when image is loading

    const isMobile = useIsMobile()

    const height = message.thumbnail_height ? isMobile ? message.thumbnail_height / 2 : message.thumbnail_height : '200'
    const width = message.thumbnail_width ? isMobile ? message.thumbnail_width / 2 : message.thumbnail_width : '300'

    const fileName = getFileName(message.file)

    const [isVisible, setIsVisible] = useState<boolean>(true)
    const contentRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (isVisible && contentRef.current) {
          setTimeout(() => {
            if(contentRef.current){
                contentRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
          }, 300); 
        }
      }, [isVisible]);

    return (
        <Flex direction='column' gap='1'>
            <Flex className='p-1'>
                <IconButton
                    size='1'
                    variant="ghost"
                    color="gray"
                    radius='large'
                    className='mr-1 cursor-pointer font-bold bg-gray-4'
                    aria-label={`Click to ${isVisible ? "hide" : "show"} image`}
                    title={`${isVisible ? "Hide" : "Show"} image`}
                    onClick={() => setIsVisible(prev => !prev)}
                >
                    {isVisible ? <BiChevronDown size='16' /> : <BiChevronRight size='16' />}
                </IconButton>
                <Link
                    href={message.file}
                    size='1'
                    color='gray'
                    target='_blank'>{fileName}
                </Link>
            </Flex>
            <Box
                ref={contentRef}
                className={`relative rounded-md cursor-pointer transition-all duration-300 ease-in-out overflow-hidden ${
                    isVisible ? 'max-h-96' : 'max-h-0'
                }`}
                role='button'
                onClick={() => setIsOpen(!isScrolling && true)}
                style={{
                    height: height + 'px',
                    width: width + 'px',
                }}>

                {/* Absolute positioned skeleton loader */}
                <Box className=' absolute top-0 z-0 left-0' style={{
                    height: height + 'px',
                    width: width + 'px',
                }}>
                    <Box style={{
                        height: height + 'px',
                        width: width + 'px',
                    }} className='bg-gray-3 z-0 dark:bg-gray-5 rounded-md'>

                    </Box>
                </Box>
                {/* We are not hiding the image when scrolling because we already know the height and width of the image
                Hence no layout shift */}
                <img
                    src={message.file}
                    loading='lazy'
                    className='z-50 absolute top-0 left-0 rounded-md shadow-md object-cover'
                    height={height}
                    style={{
                        maxHeight: height + 'px',
                        maxWidth: width + 'px',
                        minHeight: height + 'px',
                        minWidth: width + 'px',
                    }}
                    width={width}
                    alt={`Image file sent by ${message.owner} at ${message.creation}`}
                />
            </Box>
            {!isScrolling &&
                <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
                    <Dialog.Content className={clsx(DIALOG_CONTENT_CLASS, 'sm:max-w-[88vw]')}>
                        <Dialog.Title size='3'>{fileName}</Dialog.Title>
                        <Dialog.Description color='gray' size='1'>{user?.full_name ?? message.owner} on <DateMonthAtHourMinuteAmPm date={message.creation} /></Dialog.Description>
                        <Box my='4' className='w-full mx-auto items-center flex justify-center'>
                            <Suspense fallback={<img
                                src={message.file}
                                loading='lazy'
                                width='100%'
                                // height='300'
                                className='rounded-md shadow-md object-contain max-h-[600px]'
                                alt={`Image file sent by ${message.owner} at ${message.creation}`}
                            />}>
                                <ImageViewer>
                                    <img
                                        src={message.file}
                                        loading='lazy'
                                        width='100%'
                                        className='rounded-md shadow-md object-contain max-h-[90vh] sm:max-h-[600px]'
                                        alt={`Image file sent by ${message.owner} at ${message.creation}`}
                                    />
                                </ImageViewer>
                            </Suspense>

                        </Box>
                        <Flex justify='end' gap='2' mt='3'>
                            <Button variant='soft' color='gray' asChild>
                                <Link className='no-underline' href={message.file} download>
                                    <BiDownload />
                                    Download
                                </Link>
                            </Button>
                            <Dialog.Close>
                                <Button color='gray' variant='soft'>Close</Button>
                            </Dialog.Close>
                        </Flex>

                    </Dialog.Content>
                </Dialog.Root>
            }
        </Flex>
    )
})