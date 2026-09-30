export const theme = {
  ink: '#0F1116',
  inkRaise: '#181B22',
  inkCard: 'rgba(24, 27, 34, 0.94)',
  line: 'rgba(255, 255, 255, 0.10)',
  text: '#F4F5F7',
  dim: 'rgba(244, 245, 247, 0.64)',
  faint: 'rgba(244, 245, 247, 0.36)',
  brand: '#4C7DFF',
  brandLight: '#9CB6FF',
  accent: '#FFD447',
  good: '#6EE7A8',
  paper: '#F4F5F8',
  paperInk: '#171A21',
  paperDim: '#5E6572',
  paperLine: 'rgba(23, 26, 33, 0.10)',
}

/** System font stacks: no font files ship with the kit, so install Noto Sans SC for identical renders on every machine. */
export const fonts = {
  sans: '"Noto Sans SC", "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  mono: '"SF Mono", "JetBrains Mono", Menlo, Consolas, ui-monospace, monospace',
}

/** Screen layout of the framed content: 56 px top bar, 44 px bottom timeline. */
export const FRAME = {
  width: 1920,
  height: 1080,
  top: 56,
  bottom: 44,
  get contentHeight() {
    return this.height - this.top - this.bottom
  },
}
