/** The frame of the job whose print dialog may still be open; the next job removes it. */
let lastFrame: HTMLIFrameElement | null = null
/** The job being prepared: a second press of "print" meanwhile joins it instead of opening a second dialog. */
let preparing: Promise<void> | null = null

/** A frame is removed this long after its dialog opened if `afterprint` never came (some browsers skip it). */
const frameLifetimeMs = 10 * 60 * 1000

/**
 * Prints a page through the browser's print dialog, where the person picks the printer. `html` is the empty page (its
 * styles say how it prints); `draw` puts the content into its document, and may throw to stop the job before paper is
 * spent. The page is drawn into a hidden frame, so the app around it does not print. Resolves once the dialog was
 * opened: the browser cannot tell whether paper came out. One job at a time: pressing "print" again while one is being
 * prepared returns that job, and the previous job's frame is removed when the next starts.
 */
export function printInFrame(
  html: string,
  draw: (target: Document) => void
): Promise<void> {
  if (preparing) return preparing
  lastFrame?.remove()
  const job = new Promise<void>((resolve, reject) => {
    const frame = document.createElement("iframe")
    frame.setAttribute("aria-hidden", "true")
    frame.tabIndex = -1
    Object.assign(frame.style, {
      position: "fixed",
      width: "0",
      height: "0",
      border: "0",
    })
    frame.srcdoc = html
    const fail = (error: unknown) => {
      frame.remove()
      reject(error instanceof Error ? error : new Error(String(error)))
    }
    const prepare = async () => {
      const target = frame.contentDocument
      const view = frame.contentWindow
      if (target === null || view === null) {
        fail(new Error("The print frame is unavailable."))
        return
      }
      try {
        draw(target)
        // Drawn after the frame's load event, so print() itself would not wait for them; a broken logo stops the job.
        await target.fonts.ready
        await Promise.all([...target.images].map((image) => image.decode()))
        view.addEventListener(
          "afterprint",
          () => {
            frame.remove()
          },
          { once: true }
        )
        setTimeout(() => {
          frame.remove()
        }, frameLifetimeMs)
        lastFrame = frame
        view.print()
        resolve()
      } catch (error) {
        fail(error)
      }
    }
    frame.addEventListener(
      "load",
      () => {
        void prepare()
      },
      { once: true }
    )
    document.body.append(frame)
  })
  preparing = job
  const done = () => {
    preparing = null
  }
  job.then(done, done)
  return job
}
