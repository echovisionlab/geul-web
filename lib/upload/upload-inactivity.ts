/** Limits gaps in network progress without imposing a total transfer deadline. */
export function watchUploadInactivity(onIdle: () => void) {
  let timer = setTimeout(onIdle, 120_000);
  return {
    reset: () => {
      clearTimeout(timer);
      timer = setTimeout(onIdle, 120_000);
    },
    stop: () => clearTimeout(timer),
  };
}
