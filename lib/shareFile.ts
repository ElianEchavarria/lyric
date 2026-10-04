// "drake-push-ups" — safe for a filename on every OS.
export function fileSlug(artist: string, track: string): string {
  return (
    `${artist} ${track}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "lyriq"
  )
}

// On phones, hands the file to the native share sheet — that's how it reaches
// Instagram, Messages, etc. On desktop, downloads it instead.
export async function shareOrDownload(blob: Blob, fileName: string): Promise<void> {
  const file = new File([blob], fileName, { type: blob.type })

  const isTouch = window.matchMedia("(pointer: coarse)").matches
  if (isTouch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
    } catch (err) {
      // closing the share sheet without picking anything isn't a failure
      if ((err as Error).name !== "AbortError") throw err
    }
    return
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  // revoking immediately can cancel the download in some browsers
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
