export const judgeImagePath = (path, localPrefix) => {
  if (path?.startsWith('https://') || path?.startsWith('http://')) {
    return path
  } else {
    return `${localPrefix}${path}`
  }
}
