import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Check, ChevronDown, Copy, Download, Eye, FolderKanban,
  LayoutGrid, Moon, MoreHorizontal, Palette, Plus, Search, Sparkles, Sun, Trash2, Type, Upload, X,
} from 'lucide-react'
import { useDesignStore } from '../store/useDesignStore'
import { createDefaultGradientSettings, createDefaultProjectSettings } from '../data/defaults'
import { createTypographyStyleTokens, TYPOGRAPHY_SCALE } from '../data/typographyScale'
import { websitePalettes } from '../data/websitePalettes'
import { contrastRatio, createGradientCss, createPaletteCss, hexFromHsl, hslFromHex, normalizeHex, rgbFromHex } from '../utils/color'
import { getFontFamilyStack } from '../utils/fontFamily'
import { createFigmaVariablesDocument, downloadJson, isDesignProject, isWorkspaceBackup, normalizeProject } from '../utils/projectExport'

const GoogleFontPicker = lazy(() => import('../components/GoogleFontPicker').then((module) => ({ default: module.GoogleFontPicker })))

function PageTitle({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: React.ReactNode }) {
  return <div className="page-title-row"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{children && <div className="title-actions">{children}</div>}</div>
}

function Panel({ title, description, action, children, className = '' }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>{children}</section>
}

function useNotice() {
  const [notice, setNotice] = useState('')
  const notify = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2300)
  }
  return { notice, notify }
}

async function copyText(value: string, label: string, notify: (message: string) => void) {
  try {
    await navigator.clipboard.writeText(value)
    notify(`${label} copied`)
  } catch {
    notify(`Could not copy ${label.toLowerCase()}. Check clipboard permissions and try again.`)
  }
}

function downloadText(filename: string, value: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([value], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function DashboardPage() {
  const projects = useDesignStore((state) => state.projects)
  const recentProjects = [...projects].sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt))
  const active = useDesignStore((state) => state.projects.find((project) => project.id === state.activeProjectId) ?? state.projects[0])
  const setActive = useDesignStore((state) => state.setActiveProject)
  const { notice, notify } = useNotice()
  const stats = [
    { label: 'Design systems', value: projects.length.toString(), detail: 'In this workspace', icon: FolderKanban },
    { label: 'Colors', value: projects.reduce((total, project) => total + project.colors.length, 0).toString(), detail: 'Across your systems', icon: Palette },
    { label: 'Tokens', value: projects.reduce((total, project) => total + project.tokens.length, 0).toString(), detail: 'Across your systems', icon: LayoutGrid },
  ]
  const quickActions = [
    { title: 'Add colors', desc: 'Build a palette for your system', icon: Palette, to: '/colors', tone: 'blue' },
    { title: 'Set typography', desc: 'Choose a type scale', icon: Type, to: '/typography', tone: 'neutral' },
    { title: 'Set spacing', desc: 'Define a consistent rhythm', icon: LayoutGrid, to: '/spacing', tone: 'neutral' },
  ]
  return <div className="page">
    <div className="welcome-row">
      <div><div className="eyebrow">WORKSPACE</div><h1>Your design workspace</h1><p>Keep the decisions behind your product in one place.</p></div>
      <Link to="/projects" className="button-primary"><Plus size={16} /> New design system</Link>
    </div>
    {projects.length === 0 ? <section className="dashboard-empty-state panel">
      <span className="empty-overline">YOUR FIRST DESIGN SYSTEM</span>
      <h2>Start with the foundations.</h2>
      <p>Bring your colors, typography and spacing together in one place.</p>
      <Link to="/projects" className="button-primary"><Plus size={16} /> Create a design system</Link>
    </section> : <>
      <div className="stat-grid">{stats.map(({ label, value, detail, icon: Icon }) => <article className="stat-card" key={label}><div className="stat-top"><span>{label}</span><Icon size={17} /></div><div className="stat-value">{value}</div><div className="stat-change">{detail}</div></article>)}</div>
      <div className="dashboard-grid">
        <Panel title="Recent projects" description="Your latest design systems." action={<Link className="text-link" to="/projects">View all <ArrowRight size={14} /></Link>} className="recent-panel">
          <div className="project-list">{recentProjects.slice(0, 3).map((project) => <button key={project.id} className={`project-row ${active?.id === project.id ? 'selected' : ''}`} onClick={() => { setActive(project.id); notify(`${project.name} selected`) }}>
            <div className="project-thumb">{project.colors.length ? project.colors.slice(0, 5).map((color) => <i key={color.name} style={{ background: color.value }} />) : <LayoutGrid size={18} />}</div>
            <div className="project-details"><strong>{project.name}</strong><span>{project.colors.length} colors <i /> {project.tokens.length} tokens</span></div>
          </button>)}</div>
        </Panel>
        <Panel title="Keep building" description="Make the next decision for your system." className="quick-panel">
          <div className="quick-actions">{quickActions.map(({ title, desc, icon: Icon, to, tone }) => <Link className="quick-action" to={to} key={title}><span className={`quick-icon ${tone}`}><Icon size={17} /></span><span><strong>{title}</strong><small>{desc}</small></span><ArrowRight size={15} /></Link>)}</div>
        </Panel>
      </div>
      {active && <Panel title={active.name} description="A snapshot of your active system." action={<Link to="/colors" className="text-link">Open system <ArrowRight size={14} /></Link>}>
        <div className="overview-preview"><div className="overview-copy"><span className="preview-label">COLORS</span><div className="palette-strip">{active.colors.slice(0, 7).map((color) => <span key={color.name} style={{ backgroundColor: color.value }} title={`${color.name} ${color.value}`} />)}</div><span className="preview-label">TYPEFACE</span><div className="type-preview"><strong>Aa</strong><span><b>{active.settings?.typography.fontFamily ?? 'No typeface set'}</b><small>{active.settings?.typography.fontWeight ?? 'Not set'}</small></span></div></div><div className="overview-card"><span className="mini-pill">{active.colors.length} colors</span><strong>{active.tokens.length} tokens</strong><small>Saved in this design system</small></div></div>
      </Panel>}
    </>}
    {notice && <div className="toast"><span className="toast-check">✓</span>{notice}</div>}
  </div>
}

export function ColorStudioPage() {
  const project = useDesignStore((state) => state.projects.find((item) => item.id === state.activeProjectId))
  const updateColor = useDesignStore((state) => state.updateColor)
  const applyPalette = useDesignStore((state) => state.applyPalette)
  const addColor = useDesignStore((state) => state.addColor)
  const removeColor = useDesignStore((state) => state.removeColor)
  const updateGradient = useDesignStore((state) => state.updateGradient)
  const [mode, setMode] = useState('All colors')
  const [valueFormat, setValueFormat] = useState<'HEX' | 'RGB' | 'HSL'>('HEX')
  const [paletteMenuOpen, setPaletteMenuOpen] = useState(false)
  const [colorDrafts, setColorDrafts] = useState<Record<string, string>>({})
  const { notice, notify } = useNotice()
  const colors = project?.colors ?? []
  const gradient = project?.gradient ?? createDefaultGradientSettings(colors[0]?.value, colors[1]?.value)
  const gradientCss = createGradientCss(gradient)
  const paletteCss = createPaletteCss(colors, gradient)
  const baseColor = colors[0]?.value ?? '#7C6CFA'
  const filtered = mode === 'All colors' ? colors : colors.filter((color) => color.category === mode)
  const activePaletteName = websitePalettes.find((palette) =>
    palette.colors.length === colors.length && palette.colors.every((color, index) => color.name === colors[index].name && color.value === colors[index].value),
  )?.name
  const addNewColor = () => addColor({ name: `Color ${colors.length + 1}`, value: '#8B7CFA', category: 'Brand' })
  const generate = (kind: 'Complementary' | 'Analogous' | 'Triadic' | 'Monochromatic' | 'Tints' | 'Shades') => {
    const hue = Number(hslFromHex(baseColor).match(/\d+/)?.[0] ?? 265)
    const shifts = kind === 'Complementary' ? [180] : kind === 'Analogous' ? [-30, 30] : kind === 'Triadic' ? [120, 240] : [0, 0, 0]
    const lightness = kind === 'Tints' ? [70, 82, 92] : kind === 'Shades' ? [48, 34, 22] : kind === 'Monochromatic' ? [38, 55, 72] : [65, 65, 65]
    shifts.forEach((shift, index) => {
      const newHue = (hue + shift + 360) % 360
      const saturation = kind === 'Monochromatic' ? [70, 60, 75][index] : 75
      addColor({ name: `${kind} ${index + 1}`, value: hexFromHsl(newHue, saturation, lightness[index]), category: 'Generated' })
    })
    notify(`${kind} colors added`)
  }
  const exportColors = (format: 'json' | 'css') => {
    const text = format === 'json' ? JSON.stringify(colors, null, 2) : paletteCss
    downloadText(`palette.${format === 'json' ? 'json' : 'css'}`, text, format === 'json' ? 'application/json' : 'text/css')
    notify(`Palette exported as ${format.toUpperCase()}`)
  }
  const copyCss = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      notify(`${label} copied`)
    } catch {
      notify('Clipboard unavailable. Select the CSS text and copy it manually.')
    }
  }
  return <div className="page">
    <PageTitle eyebrow="DESIGN SYSTEM / FOUNDATION" title="Color studio" description="Build website palettes, reusable CSS gradients, and a consistent color language.">
      <button className="button-secondary" onClick={() => exportColors('css')}><Download size={15} /> Export CSS</button><button className="button-primary" onClick={addNewColor}><Plus size={16} /> Add color</button>
    </PageTitle>
    <div className="palette-hero"><div><span className="preview-label">ACTIVE PALETTE</span><h2>{project?.name ?? 'Your design system'}</h2><p>{colors.length} colors · {project?.tokens.length ?? 0} tokens</p></div><div className="hero-swatches">{colors.slice(0, 8).map((color) => <span key={color.name} style={{ background: color.value }} title={color.name} />)}</div></div>
    <Panel title="Website color palettes" description="Apply a coordinated palette to this project's colors and color tokens.">
      <div className="website-palette-grid">{websitePalettes.map((palette) => <button type="button" className={`website-palette-card ${activePaletteName === palette.name ? 'active' : ''}`} key={palette.name} aria-pressed={activePaletteName === palette.name} onClick={() => { applyPalette(palette.colors); setMode('All colors'); setColorDrafts({}); setValueFormat('HEX'); notify(`${palette.name} palette applied`) }}>
        <span className="website-palette-swatches">{palette.colors.slice(0, 8).map((color) => <i key={color.name} style={{ background: color.value }} title={`${color.name}: ${color.value}`} />)}</span>
        <strong>{palette.name}</strong><small>{palette.description}</small><span className="palette-apply-label">{activePaletteName === palette.name ? 'Applied' : 'Apply palette'} <ArrowRight size={12} /></span>
      </button>)}</div>
    </Panel>
    <div className="toolbar-row"><div className="tabs">{['All colors', 'Brand', 'Surface', 'Text', 'Status', 'Generated'].map((tab) => <button className={mode === tab ? 'tab-active' : ''} key={tab} onClick={() => setMode(tab)}>{tab}</button>)}</div><div className="toolbar-actions"><div className={`dropdown-wrap palette-generator ${paletteMenuOpen ? 'menu-open' : ''}`}><button className="button-secondary compact" aria-expanded={paletteMenuOpen} onClick={() => setPaletteMenuOpen(!paletteMenuOpen)}><Sparkles size={14} /> Generate palette <ChevronDown size={13} /></button><div className="export-menu">{(['Tints', 'Shades', 'Complementary', 'Analogous', 'Monochromatic', 'Triadic'] as const).map((kind) => <button key={kind} onClick={() => { generate(kind); setPaletteMenuOpen(false) }}>{kind}</button>)}</div></div><div className="format-switch">{(['HEX', 'RGB', 'HSL'] as const).map((format) => <button key={format} className={valueFormat === format ? 'selected' : ''} onClick={() => setValueFormat(format)}>{format}</button>)}</div><button className="icon-button bordered" title="Export JSON" onClick={() => exportColors('json')}><Download size={15} /></button></div></div>
    <div className="color-grid">{filtered.map((color) => {
      const originalIndex = colors.indexOf(color)
      const rgb = rgbFromHex(color.value)
      const hsl = hslFromHex(color.value).match(/\d+/g) ?? ['0', '0', '0']
      const shownValue = valueFormat === 'HEX' ? color.value : valueFormat === 'RGB' ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : `hsl(${hsl[0]} ${hsl[1]}% ${hsl[2]}%)`
      const draftKey = `${originalIndex}-${valueFormat}`
      const displayedValue = colorDrafts[draftKey] ?? shownValue
      const editValue = (value: string) => {
        setColorDrafts((drafts) => ({ ...drafts, [draftKey]: value }))
        let nextHex: string | null = null
        if (valueFormat === 'HEX') {
          nextHex = normalizeHex(value)
        } else if (valueFormat === 'RGB') {
          const match = value.match(/^\s*rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)\s*$/i)
          if (match) nextHex = `#${match.slice(1).map((part) => Math.min(255, Number(part)).toString(16).padStart(2, '0')).join('').toUpperCase()}`
        } else {
          const match = value.match(/^\s*hsl\(\s*(-?\d{1,3})\s+(\d{1,3})%\s+(\d{1,3})%\s*\)\s*$/i)
          if (match) nextHex = hexFromHsl(Number(match[1]), Number(match[2]), Number(match[3]))
        }
        if (nextHex) {
          updateColor(originalIndex, { value: nextHex })
          const nextRgb = rgbFromHex(nextHex)
          const nextHsl = hslFromHex(nextHex).match(/\d+/g) ?? ['0', '0', '0']
          const normalized = valueFormat === 'HEX' ? nextHex : valueFormat === 'RGB' ? `rgb(${nextRgb.r}, ${nextRgb.g}, ${nextRgb.b})` : `hsl(${nextHsl[0]} ${nextHsl[1]}% ${nextHsl[2]}%)`
          setColorDrafts((drafts) => ({ ...drafts, [draftKey]: normalized }))
        }
      }
      return <article className="color-card" key={originalIndex}><div className="color-chip" style={{ background: color.value }}><input aria-label={`Pick ${color.name}`} type="color" value={normalizeHex(color.value) ?? '#000000'} onChange={(event) => updateColor(originalIndex, { value: event.target.value.toUpperCase() })} /><button type="button" title="Copy color" onClick={() => void copyText(color.value, color.value, notify)}><Copy size={14} /></button></div><div className="color-card-content"><div className="color-name-row"><input aria-label="Color name" value={color.name} onChange={(event) => updateColor(originalIndex, { name: event.target.value })} /><button type="button" className="icon-button subtle danger-hover" aria-label={`Remove ${color.name}`} onClick={() => removeColor(originalIndex)}><Trash2 size={14} /></button></div><div className="color-data"><input aria-label={`${color.name} ${valueFormat} value`} value={displayedValue} onChange={(event) => editValue(event.target.value)} onBlur={() => setColorDrafts((drafts) => ({ ...drafts, [draftKey]: shownValue }))} /><span>{valueFormat === 'HEX' ? `RGB ${rgb.r}, ${rgb.g}, ${rgb.b} · ${hslFromHex(color.value)}` : `HEX ${color.value}`}</span></div><div className="color-meta"><span>{color.category}</span><span>{contrastRatio(color.value, '#FFFFFF').toFixed(2)}:1 <i>on white</i></span></div></div></article>
    })}</div>
    <Panel title="CSS gradient builder" description="Design a reusable gradient and export it alongside your website color variables." className="gradient-builder-panel">
      <div className="gradient-builder">
        <div className="gradient-live-preview" style={{ background: gradientCss }}>
          <div><span>LIVE WEBSITE PREVIEW</span><strong>Color with a little more depth.</strong><small>{gradient.type === 'linear' ? `${gradient.angle}° linear gradient` : 'Radial gradient'}</small></div>
        </div>
        <div className="gradient-editor">
          <div className="gradient-control-grid">
            <label className="field-label">Gradient style<select className="field-control" value={gradient.type} onChange={(event) => updateGradient({ type: event.target.value === 'radial' ? 'radial' : 'linear' })}><option value="linear">Linear</option><option value="radial">Radial</option></select></label>
            {gradient.type === 'linear' && <label className="field-label range-label">Angle <b>{gradient.angle}°</b><input className="range-control" type="range" min="0" max="360" step="5" value={gradient.angle} onChange={(event) => updateGradient({ angle: Number(event.target.value) })} /></label>}
            <label className="field-label">Start color<span className="gradient-color-control"><input aria-label="Gradient start color" type="color" value={gradient.startColor} onChange={(event) => updateGradient({ startColor: event.target.value.toUpperCase() })} /><code>{gradient.startColor}</code></span></label>
            <label className="field-label">End color<span className="gradient-color-control"><input aria-label="Gradient end color" type="color" value={gradient.endColor} onChange={(event) => updateGradient({ endColor: event.target.value.toUpperCase() })} /><code>{gradient.endColor}</code></span></label>
          </div>
          <pre className="gradient-css-code"><code>background: {gradientCss};</code></pre>
          <div className="gradient-actions"><button className="button-secondary" onClick={() => void copyCss('Gradient CSS', `background: ${gradientCss};`)}><Copy size={13} /> Copy gradient CSS</button><button className="button-secondary" onClick={() => void copyCss('Palette CSS', paletteCss)}><Copy size={13} /> Copy palette CSS</button></div>
        </div>
      </div>
    </Panel>
    <div className="two-col lower-spacing"><Panel title="Color harmonies" description="Generate balanced colors from your primary hue."><div className="harmony-list">{(['Complementary', 'Analogous', 'Triadic', 'Monochromatic', 'Tints', 'Shades'] as const).map((kind) => <button className="harmony-row" key={kind} onClick={() => generate(kind)}><span><strong>{kind}</strong><small>{kind === 'Complementary' ? 'Opposite hues for visual energy' : kind === 'Analogous' ? 'Neighboring hues for harmony' : kind === 'Triadic' ? 'Three evenly-spaced colors' : kind === 'Monochromatic' ? 'One hue, varied saturation and value' : kind === 'Tints' ? 'Lighter values of your base color' : 'Deeper values of your base color'}</small></span><span className="harmony-swatch"><i style={{ background: baseColor }} /><i style={{ background: hexFromHsl(Number(hslFromHex(baseColor).match(/\d+/)?.[0] ?? 265), 75, kind === 'Shades' ? 38 : 72) }} /><i style={{ background: hexFromHsl(Number(hslFromHex(baseColor).match(/\d+/)?.[0] ?? 265), 75, kind === 'Tints' ? 92 : 55) }} /></span><ArrowRight size={15} /></button>)}</div></Panel>
      <Panel title="Palette preview" description="A quick look at your colors in context."><div className="palette-demo"><div className="demo-nav"><span className="demo-logo" /><span /><span /><span /></div><div className="demo-content"><span className="demo-kicker">MADE FOR MOMENTUM</span><strong>Clarity in every<br />color.</strong><p>A considered palette makes everything feel connected.</p><span className="preview-cta" style={{ background: baseColor }}>Explore the system <ArrowRight size={13} /></span></div><div className="demo-footer"><span /><span /><span /></div></div></Panel></div>
    {notice && <div className="toast"><span className="toast-check">✓</span>{notice}</div>}
  </div>
}

export function TypographyStudioPage() {
  const project = useDesignStore((state) => state.projects.find((item) => item.id === state.activeProjectId))
  const updateProjectSettings = useDesignStore((state) => state.updateProjectSettings)
  const typography = project?.settings?.typography ?? createDefaultProjectSettings().typography
  const { fontFamily: font, fontWeight: weight, fontSize: size, lineHeight, letterSpacing, mobile, textTransform: transform } = typography
  const fontFamilyStack = getFontFamilyStack(font)
  const [availableWeights, setAvailableWeights] = useState([400, 500, 600, 700])
  const updateAvailableWeights = useCallback((weights?: number[]) => setAvailableWeights(weights?.length ? weights : [400, 500, 600, 700]), [])
  const weightOptions = availableWeights.includes(Number(weight)) ? availableWeights : [...availableWeights, Number(weight)].sort((a, b) => a - b)
  const setFont = (fontFamily: string) => updateProjectSettings({ typography: { fontFamily } })
  const setWeight = (fontWeight: string) => updateProjectSettings({ typography: { fontWeight } })
  const setSize = (fontSize: number) => updateProjectSettings({ typography: { fontSize } })
  const setLineHeight = (lineHeightValue: number) => updateProjectSettings({ typography: { lineHeight: lineHeightValue } })
  const setLetterSpacing = (letterSpacingValue: number) => updateProjectSettings({ typography: { letterSpacing: letterSpacingValue } })
  const setMobile = (mobileValue: boolean) => updateProjectSettings({ typography: { mobile: mobileValue } })
  const setTransform = (textTransform: 'none' | 'uppercase' | 'capitalize') => updateProjectSettings({ typography: { textTransform } })
  const { notice, notify } = useNotice()
  const scale = TYPOGRAPHY_SCALE.map(({ label, desktopSize, mobileSize, weight }) => [label, mobile ? mobileSize : desktopSize, String(weight)] as const)
  return <div className="page">
    <PageTitle eyebrow="DESIGN SYSTEM / FOUNDATION" title="Typography studio" description="Give every word a role with a clear, flexible type system.">
      <button className="button-secondary" onClick={() => { downloadText('typography-tokens.json', JSON.stringify(createTypographyStyleTokens(typography), null, 2)); notify('Typography tokens exported') }}><Download size={15} /> Export tokens</button>
    </PageTitle>
    <div className="studio-layout">
      <div className="studio-main"><Panel title="Type scale" description="A modular scale that works across screens." action={<div className="segmented"><button className={!mobile ? 'selected' : ''} onClick={() => setMobile(false)}>Desktop</button><button className={mobile ? 'selected' : ''} onClick={() => setMobile(true)}>Mobile</button></div>}><div className="type-hierarchy">{scale.map(([name, px, fontWeight]) => <div className="type-line" key={name}><span className="type-label">{name}<small>{px}px / {fontWeight}</small></span><div style={{ fontSize: `${mobile ? Math.min(px, 48) : px}px`, fontWeight: fontWeight as React.CSSProperties['fontWeight'], fontFamily: fontFamilyStack, letterSpacing: `${letterSpacing}px`, textTransform: transform }}>{name === 'Overline' ? 'DESIGN WITH INTENTION' : name === 'Display' ? 'Make it matter.' : 'The quick brown fox jumps.'}</div></div>)}</div></Panel>
        <Suspense fallback={<div className="panel google-font-loading">Loading Google Fonts library…</div>}><GoogleFontPicker projectName={project?.name ?? 'Your design system'} selectedFamily={font} selectedWeight={weight} onSelect={(selected, selectedWeight) => updateProjectSettings({ typography: { fontFamily: selected.family, fontWeight: selectedWeight } })} onWeightsChange={updateAvailableWeights} notify={notify} /></Suspense>
        <Panel title="Font pairing" description="A few thoughtfully paired starting points."><div className="pairing-grid">{[['Inter', 'DM Sans', 'Modern & neutral'], ['Manrope', 'Source Serif 4', 'Warm & editorial'], ['Space Grotesk', 'Inter', 'Technical & distinct']].map(([heading, body, mood]) => <button className="pairing-card" key={heading} onClick={() => { setFont(heading); notify(`${heading} + ${body} selected`) }}><div style={{ fontFamily: heading }}><strong>{heading}</strong><span style={{ fontFamily: body }}>Aa</span></div><small>{heading} <i>+</i> {body}</small><small className="pairing-mood">{mood}</small></button>)}</div></Panel></div>
      <aside className="studio-side"><Panel title="Text settings" description="Tune your live preview."><label className="field-label">Font family</label><input className="field-control" aria-label="Selected font family" value={font} readOnly /><small className="font-selection-hint">Choose from the Google Fonts library.</small><label className="field-label">Font weight</label><select className="field-control" value={weight} onChange={(event) => setWeight(event.target.value)}>{weightOptions.map((value) => <option value={value} key={value}>{value} · {({ 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' } as Record<number, string>)[value] ?? 'Custom'}</option>)}</select><label className="field-label range-label">Font size <b>{size}px</b></label><input className="range-control" type="range" min="12" max="48" value={size} onChange={(event) => setSize(Number(event.target.value))} /><label className="field-label range-label">Line height <b>{lineHeight.toFixed(1)}</b></label><input className="range-control" type="range" min="1" max="2" step="0.1" value={lineHeight} onChange={(event) => setLineHeight(Number(event.target.value))} /><label className="field-label range-label">Letter spacing <b>{letterSpacing.toFixed(1)}px</b></label><input className="range-control" type="range" min="-2" max="4" step="0.1" value={letterSpacing} onChange={(event) => setLetterSpacing(Number(event.target.value))} /><div className="text-transform-row">{(['none', 'uppercase', 'capitalize'] as const).map((value) => <button className={transform === value ? 'selected' : ''} key={value} onClick={() => setTransform(value)}>{value === 'none' ? 'None' : value}</button>)}</div><div className="live-type-preview"><span className="preview-label">LIVE PREVIEW</span><p style={{ fontFamily: fontFamilyStack, fontSize: `${size}px`, fontWeight: Number(weight), lineHeight, letterSpacing: `${letterSpacing}px`, textTransform: transform }}>{'Design systems help teams move faster without losing the details that make a product feel human.'}</p><small>{font} · {weight} · {size}px / {lineHeight.toFixed(1)}</small></div></Panel></aside>
    </div>{notice && <div className="toast"><span className="toast-check">✓</span>{notice}</div>}
  </div>
}

export function SpacingStudioPage() {
  const project = useDesignStore((state) => state.projects.find((item) => item.id === state.activeProjectId))
  const updateProjectSettings = useDesignStore((state) => state.updateProjectSettings)
  const spacingSettings = project?.settings?.spacing ?? createDefaultProjectSettings().spacing
  const { baseUnit: base, containerWidth: container, columns, gutter, borderRadius: radius } = spacingSettings
  const setBase = (baseUnit: number) => updateProjectSettings({ spacing: { baseUnit } })
  const setContainer = (containerWidth: number) => updateProjectSettings({ spacing: { containerWidth } })
  const setColumns = (columnCount: number) => updateProjectSettings({ spacing: { columns: columnCount } })
  const setGutter = (gutterSize: number) => updateProjectSettings({ spacing: { gutter: gutterSize } })
  const setRadius = (borderRadius: number) => updateProjectSettings({ spacing: { borderRadius } })
  const spacing = [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24].map((multiple) => base * multiple)
  const { notice, notify } = useNotice()
  return <div className="page">
    <PageTitle eyebrow="DESIGN SYSTEM / FOUNDATION" title="Spacing studio" description="Create rhythm and structure with a consistent layout system."><button className="button-primary" onClick={() => { downloadText('spacing-tokens.json', JSON.stringify({ baseUnit: base, spacing, container }, null, 2)); notify('Spacing scale exported') }}><Download size={15} /> Export scale</button></PageTitle>
    <div className="studio-layout">
      <div className="studio-main"><Panel title="Spacing scale" description="A repeatable set of steps, based on your chosen unit."><div className="spacing-scale">{spacing.map((value, index) => <div className="spacing-item" key={`${value}-${index}`}><div className="spacing-bar-wrap"><span className="spacing-bar" style={{ width: `${Math.min(value * 1.65, 156)}px` }} /></div><b>{value}px</b><small>{`space.${index + 1}`}</small></div>)}</div></Panel>
        <Panel title="Layout preview" description="See your spacing choices in a realistic layout."><div className="layout-preview"><div className="preview-frame" style={{ maxWidth: `${container}px` }}><div className="preview-frame-nav"><b>Goodform</b><span>About</span><span>Resources</span><span className="preview-cta">Get started</span></div><div className="preview-frame-content" style={{ padding: `${base * 8}px ${base * 10}px` }}><span className="demo-kicker">A BETTER WAY TO WORK</span><h3>Make space for<br />the good stuff.</h3><p>Build thoughtful experiences that feel simple from the very first click.</p><span className="preview-cta">Discover more <ArrowRight size={13} /></span><div className="layout-cards" style={{ gap: `${gutter / 4}px` }}>{Array.from({ length: Math.max(3, columns / 4) }, (_, index) => <span key={index} style={{ borderRadius: `${radius}px` }} />)}</div></div></div></div></Panel>
      </div>
      <aside className="studio-side"><Panel title="Layout settings" description="Set your foundational dimensions."><label className="field-label range-label">Base unit <b>{base}px</b></label><input className="range-control" type="range" min="2" max="8" value={base} onChange={(event) => setBase(Number(event.target.value))} /><p className="field-hint">Your scale uses multiples of {base}px.</p><label className="field-label range-label">Container max width <b>{container}px</b></label><input className="range-control" type="range" min="960" max="1440" step="24" value={container} onChange={(event) => setContainer(Number(event.target.value))} /><div className="settings-divider" /><label className="field-label">Grid columns</label><div className="choice-row">{[12, 8, 4].map((value) => <button className={columns === value ? 'selected' : ''} key={value} onClick={() => setColumns(value)}>{value} col</button>)}</div><label className="field-label">Gutter</label><select className="field-control" value={gutter} onChange={(event) => setGutter(Number(event.target.value))}><option value="16">16px</option><option value="24">24px</option><option value="32">32px</option></select><label className="field-label">Border radius <b>{radius}px</b></label><div className="radius-options">{[[4, 'Sm'], [8, 'Md'], [14, 'Lg'], [50, 'Full']].map(([value, label]) => <button className={radius === value ? 'selected' : ''} key={label} onClick={() => setRadius(Number(value))}><i style={{ borderRadius: Number(value) }} />{label}</button>)}</div><div className="breakpoint-list"><span>Breakpoints</span><small>Mobile <b>640px</b></small><small>Tablet <b>768px</b></small><small>Desktop <b>1024px</b></small></div></Panel></aside>
    </div>{notice && <div className="toast"><span className="toast-check">✓</span>{notice}</div>}
  </div>
}

const componentGroups = [
  { title: 'BUTTONS', items: ['Primary button', 'Secondary button', 'Tertiary button', 'Outline button', 'Ghost button', 'Destructive button', 'Icon button'] },
  { title: 'INPUTS', items: ['Text field', 'Search field', 'Password field', 'Textarea', 'Select', 'Checkbox', 'Radio', 'Toggle', 'Date picker'] },
  { title: 'NAVIGATION', items: ['Tabs', 'Breadcrumb', 'Pagination', 'Dropdown menu'] },
  { title: 'CONTENT', items: ['Card', 'Badge', 'Avatar', 'Tooltip', 'Alert', 'Progress bar', 'Empty state'] },
  { title: 'OVERLAYS & DATA', items: ['Modal', 'Confirmation dialog', 'Drawer', 'Popover', 'Table', 'Statistics card', 'List item'] },
]
const componentOptions = componentGroups.flatMap((group) => group.items)
export function ComponentStudioPage() {
  const project = useDesignStore((store) => store.projects.find((item) => item.id === store.activeProjectId))
  const updateProjectSettings = useDesignStore((store) => store.updateProjectSettings)
  const componentSettings = project?.settings?.component ?? createDefaultProjectSettings().component
  const customComponents = componentSettings.customComponents ?? []
  const [componentSearch, setComponentSearch] = useState('')
  const [previewClicks, setPreviewClicks] = useState(0)
  const [previewToggle, setPreviewToggle] = useState(false)
  const { name: component, state, size, radius, label } = componentSettings
  const setComponent = (name: string) => updateProjectSettings({ component: { name } })
  const setState = (componentState: string) => updateProjectSettings({ component: { state: componentState } })
  const setSize = (componentSize: string) => updateProjectSettings({ component: { size: componentSize } })
  const setRadius = (componentRadius: number) => updateProjectSettings({ component: { radius: componentRadius } })
  const setLabel = (componentLabel: string) => updateProjectSettings({ component: { label: componentLabel } })
  const { notice, notify } = useNotice()
  const matchingGroups = componentGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.toLowerCase().includes(componentSearch.toLowerCase())) }))
    .filter((group) => group.items.length > 0)
  const matchingCustomComponents = customComponents.filter((item) => item.toLowerCase().includes(componentSearch.toLowerCase()))
  const addCustomComponent = () => {
    const name = `Custom component ${customComponents.length + 1}`
    updateProjectSettings({ component: { customComponents: [...customComponents, name] } })
    setComponent(name)
    setComponentSearch('')
    notify(`${name} added to this library`)
  }
  const removeCustomComponent = (name: string) => {
    updateProjectSettings({ component: { customComponents: customComponents.filter((item) => item !== name) } })
    if (component === name) setComponent(componentOptions[0])
    notify(`${name} removed from this library`)
  }
  const buttonStyle = { borderRadius: `${radius}px`, padding: size === 'Small' ? '8px 13px' : size === 'Large' ? '14px 22px' : '11px 17px', opacity: state === 'Disabled' ? 0.45 : 1 }
  const jsx = `<button className="${component.toLowerCase().replace(/\s+/g, '-')}" disabled={${state === 'Disabled'}}>${label}</button>`
  const css = `.component { border-radius: ${radius}px; padding: ${size === 'Small' ? '8px 13px' : size === 'Large' ? '14px 22px' : '11px 17px'}; }`
  return <div className="page">
    <PageTitle eyebrow="DESIGN SYSTEM / COMPONENTS" title="Component studio" description="Explore, tune, and document your reusable interface building blocks."><button type="button" className="button-secondary" onClick={() => { downloadText('component-config.json', JSON.stringify({ component, state, size, radius, label }, null, 2)); notify('Component configuration exported') }}><Download size={15} /> Export</button></PageTitle>
    <div className="component-workspace"><aside className="component-library panel"><div className="panel-heading"><div><h2>Library</h2><p>{componentOptions.length + customComponents.length} components</p></div><button type="button" className="icon-button subtle" onClick={addCustomComponent} aria-label="Add component" title="Add custom component"><Plus size={15} /></button></div><div className="component-search"><Search size={14} /><input placeholder="Find a component" value={componentSearch} onChange={(event) => setComponentSearch(event.target.value)} /></div>{matchingGroups.map((group) => <div className="component-category" key={group.title}><span>{group.title}</span>{group.items.map((item) => <button type="button" className={component === item ? 'chosen' : ''} key={item} onClick={() => setComponent(item)}><span className="component-glyph">{group.title === 'BUTTONS' ? 'B' : group.title === 'INPUTS' ? '□' : group.title === 'NAVIGATION' ? '↗' : '▤'}</span>{item}</button>)}</div>)}{matchingCustomComponents.length > 0 && <div className="component-category"><span>CUSTOM</span>{matchingCustomComponents.map((item) => <div className="component-category-row" key={item}><button type="button" className={component === item ? 'chosen' : ''} onClick={() => setComponent(item)}><span className="component-glyph">C</span>{item}</button><button type="button" className="component-remove" aria-label={`Remove ${item}`} title={`Remove ${item}`} onClick={() => removeCustomComponent(item)}><Trash2 size={13} /></button></div>)}</div>}{matchingGroups.length === 0 && matchingCustomComponents.length === 0 && <div className="empty-state">No components match your search.</div>}</aside>
      <div className="component-main"><Panel title="Preview" description={`${component} · interactive preview`} action={<button type="button" className="icon-button bordered" title="Reset preview" aria-label="Reset component preview" onClick={() => { setPreviewClicks(0); setPreviewToggle(false); notify('Component preview reset') }}><Eye size={15} /></button>}><div className="component-preview-area">{component.toLowerCase().includes('button') ? <button type="button" className={`sample-button state-${state.toLowerCase()} ${component.includes('Secondary') || component.includes('Tertiary') || component.includes('Ghost') || component.includes('Outline') ? 'secondary' : ''} ${component.includes('Destructive') ? 'destructive' : ''}`} style={buttonStyle} disabled={state === 'Disabled'} onClick={() => setPreviewClicks((count) => count + 1)}>{state === 'Loading' ? <><span className="spinner" /> Loading</> : component === 'Icon button' ? <Sparkles size={15} /> : label}</button> : component.includes('field') ? <input className={`demo-input state-${state.toLowerCase()}`} type={component === 'Password field' ? 'password' : 'text'} placeholder={component === 'Search field' ? '⌕  Search...' : 'Enter your email'} disabled={state === 'Disabled'} /> : component === 'Textarea' ? <textarea className={`demo-input state-${state.toLowerCase()}`} placeholder="Write a message..." disabled={state === 'Disabled'} /> : component === 'Select' || component === 'Date picker' ? <select className="demo-input"><option>{component === 'Date picker' ? 'Choose a date' : 'Choose an option'}</option><option>Option one</option><option>Option two</option></select> : component === 'Checkbox' ? <label className="demo-checkbox"><input type="checkbox" /> Remember this device</label> : component === 'Radio' ? <label className="demo-checkbox"><input type="radio" name="preview-radio" /> Select this option</label> : component === 'Toggle' ? <button type="button" className={`toggle-switch ${previewToggle ? 'on' : ''}`} aria-label="Toggle preview" aria-pressed={previewToggle} onClick={() => setPreviewToggle((current) => !current)}><i /></button> : component === 'Badge' ? <span className="sample-badge">In progress</span> : component === 'Alert' ? <div className="sample-alert"><Sparkles size={16} /> Your workspace is looking good.</div> : component === 'Progress bar' ? <div className="sample-progress"><span /><i /></div> : component === 'Avatar' ? <div className="sample-avatar">AB</div> : <div className="sample-content-card"><div className="sample-card-art" /><strong>{component === 'Card' ? 'A thoughtful card' : component}</strong><span>Keep the details consistent across your product.</span></div>}</div><p className="component-preview-status" aria-live="polite">{previewClicks ? `Preview activated ${previewClicks} time${previewClicks === 1 ? '' : 's'}.` : 'Interact with the preview to test its state.'}</p></Panel>
        <Panel title="Component properties" description="Tune the details and see your changes live."><div className="property-grid"><div><label className="field-label">Label</label><input className="field-control" value={label} onChange={(event) => setLabel(event.target.value)} /></div><div><label className="field-label">Size</label><select className="field-control" value={size} onChange={(event) => setSize(event.target.value)}>{['Small', 'Medium', 'Large'].map((item) => <option key={item}>{item}</option>)}</select></div><div><label className="field-label">State</label><select className="field-control" value={state} onChange={(event) => setState(event.target.value)}>{['Default', 'Hover', 'Focus', 'Active', 'Disabled', 'Loading', 'Error', 'Success'].map((item) => <option key={item}>{item}</option>)}</select></div><div><label className="field-label range-label">Radius <b>{radius}px</b></label><input className="range-control" type="range" min="0" max="24" value={radius} onChange={(event) => setRadius(Number(event.target.value))} /></div></div><div className="code-actions"><button type="button" className="button-secondary" onClick={() => void copyText(jsx, 'JSX', notify)}><Copy size={14} /> Copy JSX</button><button type="button" className="button-secondary" onClick={() => void copyText(css, 'CSS', notify)}><Copy size={14} /> Copy CSS</button></div></Panel></div></div>{notice && <div className="toast"><span className="toast-check">✓</span>{notice}</div>}
  </div>
}

export function AccessibilityPage() {
  const [foreground, setForeground] = useState('#F4F5F8')
  const [background, setBackground] = useState('#151923')
  const [fontSize, setFontSize] = useState(16)
  const contrast = contrastRatio(foreground, background)
  const aa = contrast >= (fontSize >= 24 ? 3 : 4.5)
  const aaa = contrast >= (fontSize >= 24 ? 4.5 : 7)
  return <div className="page"><PageTitle eyebrow="DESIGN TOOLS / ACCESSIBILITY" title="Accessibility checker" description="Check color contrast and make more readable interface choices."><span className="sample-tag"><span /> Color contrast tool</span></PageTitle>
    <div className="studio-layout accessibility-layout"><div className="studio-main"><Panel title="Contrast preview" description="Live preview of your foreground and background colors."><div className="contrast-preview" style={{ backgroundColor: background, color: foreground }}><span>TEXT PREVIEW</span><h2 style={{ fontSize: `${Math.min(fontSize * 2, 40)}px` }}>Clarity is a feature.</h2><p style={{ fontSize: `${fontSize}px` }}>Accessible design makes every interaction easier to understand.</p><span className="preview-cta">Continue <ArrowRight size={14} /></span></div><div className="contrast-score"><div><span>Contrast ratio</span><strong>{contrast.toFixed(2)}<small>:1</small></strong></div><div className={`wcag-result ${aa ? 'pass' : 'fail'}`}><span>{aa ? <Check size={14} /> : <X size={14} />}</span><b>WCAG AA</b><small>{aa ? 'Pass' : 'Does not pass'}</small></div><div className={`wcag-result ${aaa ? 'pass' : 'fail'}`}><span>{aaa ? <Check size={14} /> : <X size={14} />}</span><b>WCAG AAA</b><small>{aaa ? 'Pass' : 'Does not pass'}</small></div></div></Panel><Panel title="Accessibility checklist" description="A few essential checks to keep in mind."><div className="check-list">{[['✓', 'Form controls have visible labels', 'Give every input a programmatic and visible label.'], ['✓', 'Focus states are easy to see', 'Use a distinct focus ring with sufficient contrast.'], ['!', 'Buttons use clear action labels', 'Avoid vague labels like “click here” or “submit”.']].map(([icon, title, text]) => <div className="check-list-item" key={title}><span className={icon === '!' ? 'warn-icon' : 'ok-icon'}>{icon}</span><div><b>{title}</b><small>{text}</small></div></div>)}</div></Panel></div>
      <aside className="studio-side"><Panel title="Color settings" description="Adjust colors to test contrast."><label className="field-label">Foreground</label><div className="color-picker-field"><input type="color" value={foreground} onChange={(event) => setForeground(event.target.value.toUpperCase())} /><input value={foreground} onChange={(event) => { const valid = normalizeHex(event.target.value); if (valid) setForeground(valid) }} /></div><label className="field-label">Background</label><div className="color-picker-field"><input type="color" value={background} onChange={(event) => setBackground(event.target.value.toUpperCase())} /><input value={background} onChange={(event) => { const valid = normalizeHex(event.target.value); if (valid) setBackground(valid) }} /></div><label className="field-label range-label">Text size <b>{fontSize}px</b></label><input className="range-control" type="range" min="12" max="30" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /><div className="recommendation"><Sparkles size={15} /><span><b>{aa ? 'Looking good' : 'Try a higher contrast'}</b><small>{aa ? 'This combination meets WCAG AA for this text size.' : 'Increase contrast between these colors to meet WCAG AA.'}</small></span></div><button className="button-secondary full-width" onClick={() => { setForeground('#FFFFFF'); setBackground('#111827') }}>Use accessible example</button></Panel></aside></div>
    <p className="disclaimer">This tool checks color contrast only. It does not audit external Figma files or replace a complete accessibility review.</p>
  </div>
}

const tokenGroups = ['All tokens', 'Colors', 'Typography', 'Spacing', 'Radius']
type LibraryToken = { name: string; value: string; group: string; source: 'library' | 'studio' }

export function TokensPage() {
  const project = useDesignStore((state) => state.projects.find((item) => item.id === state.activeProjectId) ?? state.projects[0])
  const addToken = useDesignStore((state) => state.addToken)
  const removeToken = useDesignStore((state) => state.removeToken)
  const updateToken = useDesignStore((state) => state.updateToken)
  const [group, setGroup] = useState('All tokens')
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [tokenGroup, setTokenGroup] = useState('Colors')
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [previewFontStatus, setPreviewFontStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const { notice, notify } = useNotice()
  const tokens = project?.tokens ?? []
  const colors = project?.colors ?? []
  const settings = project?.settings ?? createDefaultProjectSettings()
  const { typography, spacing } = settings
  const previewFontFamily = getFontFamilyStack(typography.fontFamily)
  useEffect(() => {
    let active = true
    setPreviewFontStatus('loading')
    void import('../utils/googleFonts').then(async ({ GOOGLE_FONTS, ensureGoogleFontLoaded }) => {
      const selectedFont = GOOGLE_FONTS.find((font) => font.family === typography.fontFamily)
      if (selectedFont) await ensureGoogleFontLoaded(selectedFont)
      if (active) setPreviewFontStatus('ready')
    })
      .catch(() => { if (active) setPreviewFontStatus('error') })
    return () => { active = false }
  }, [typography.fontFamily])
  const spacingSteps = [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24].map((step) => step * spacing.baseUnit)
  const syncedColorNames = new Set(colors.map((color) => `color.${color.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`))
  const studioTokens: LibraryToken[] = [
    ...colors.map((color) => ({
      name: `color.${(color.category.trim() || 'Brand').replace(/[^a-zA-Z0-9_-]/g, '-')}.${color.name.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
      value: color.value,
      group: 'Colors',
      source: 'studio' as const,
    })),
    { name: 'typography.font-family', value: typography.fontFamily, group: 'Typography', source: 'studio' },
    { name: 'typography.font-weight', value: typography.fontWeight, group: 'Typography', source: 'studio' },
    { name: 'typography.font-size', value: `${typography.fontSize}px`, group: 'Typography', source: 'studio' },
    { name: 'typography.line-height', value: `${Number((typography.lineHeight * 100).toFixed(2))}%`, group: 'Typography', source: 'studio' },
    { name: 'typography.letter-spacing', value: `${typography.letterSpacing}px`, group: 'Typography', source: 'studio' },
    { name: 'typography.text-case', value: typography.textTransform, group: 'Typography', source: 'studio' },
    ...createTypographyStyleTokens(typography).map((token) => ({ name: token.name, value: token.value, group: 'Typography', source: 'studio' as const })),
    { name: 'spacing.base-unit', value: `${spacing.baseUnit}px`, group: 'Spacing', source: 'studio' },
    ...spacingSteps.map((step, index) => ({ name: `spacing.scale.${index + 1}`, value: `${step}px`, group: 'Spacing', source: 'studio' as const })),
    { name: 'layout.container-width', value: `${spacing.containerWidth}px`, group: 'Spacing', source: 'studio' },
    { name: 'layout.columns', value: String(spacing.columns), group: 'Spacing', source: 'studio' },
    { name: 'layout.gutter', value: `${spacing.gutter}px`, group: 'Spacing', source: 'studio' },
    { name: 'component.button.padding-horizontal', value: `${settings.component.size === 'Small' ? 13 : settings.component.size === 'Large' ? 22 : 17}px`, group: 'Spacing', source: 'studio' },
    { name: 'component.button.padding-vertical', value: `${settings.component.size === 'Small' ? 8 : settings.component.size === 'Large' ? 14 : 11}px`, group: 'Spacing', source: 'studio' },
    { name: 'radius.default', value: `${spacing.borderRadius}px`, group: 'Radius', source: 'studio' },
    { name: 'component.button.radius', value: `${settings.component.radius}px`, group: 'Radius', source: 'studio' },
  ]
  const libraryTokensByName = new Map<string, LibraryToken>()
  tokens
    .filter((token) => token.group !== 'Colors' || !syncedColorNames.has(token.name))
    .forEach((token) => libraryTokensByName.set(token.name, { ...token, source: 'library' }))
  studioTokens.forEach((token) => libraryTokensByName.set(token.name, token))
  const libraryTokens = [...libraryTokensByName.values()]
  const groupCount = new Set(libraryTokens.map((token) => token.group)).size
  const visible = libraryTokens.filter((token) => (group === 'All tokens' || token.group === group) && `${token.name} ${token.value}`.toLowerCase().includes(query.toLowerCase()))
  const exportFigmaVariables = () => {
    if (!project) return
    const slug = project.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'design-system'
    downloadJson(`${slug}-figma-variables.json`, createFigmaVariablesDocument(project))
    notify('Figma Variables JSON exported from the reviewed studio settings')
  }
  const exportTokens = (format: string) => {
    const exportableTokens = libraryTokens.map(({ name: tokenName, value: tokenValue, group: tokenGroupName }) => ({ name: tokenName, value: tokenValue, group: tokenGroupName }))
    let result = ''
    let type = 'text/plain'
    if (format === 'JSON') { result = JSON.stringify(exportableTokens, null, 2); type = 'application/json' }
    if (format === 'CSS') result = `:root {\n${exportableTokens.map((token) => `  --${token.name.replace(/\./g, '-')}: ${token.value};`).join('\n')}\n}`
    if (format === 'SCSS') result = exportableTokens.map((token) => `$${token.name.replace(/\./g, '-')}: ${token.value};`).join('\n')
    if (format === 'Tailwind') { result = `export default {\n  theme: {\n    extend: {\n      colors: {\n${exportableTokens.filter((token) => token.group === 'Colors').map((token) => `        '${token.name.split('.').pop()}': '${token.value}',`).join('\n')}\n      },\n    },\n  },\n}`; type = 'text/javascript' }
    downloadText(`design-tokens.${format === 'JSON' ? 'json' : format === 'SCSS' ? 'scss' : format === 'Tailwind' ? 'js' : 'css'}`, result, type)
    notify(`${format} tokens exported`)
  }
  const createToken = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !value.trim()) return
    if (libraryTokens.some((token) => token.name === name.trim())) {
      notify('A token with this name already exists')
      return
    }
    addToken({ name: name.trim(), value: value.trim(), group: tokenGroup })
    setName('')
    setValue('')
    notify('Token added to your system')
  }
  return <div className="page"><PageTitle eyebrow="DESIGN SYSTEM / TOKENS" title="Design tokens" description="Review studio values and token variables in one place before exporting."><div className={`dropdown-wrap ${exportMenuOpen ? 'menu-open' : ''}`}><button type="button" className="button-secondary" aria-expanded={exportMenuOpen} onClick={() => setExportMenuOpen((open) => !open)}><Download size={15} /> Export tokens <ChevronDown size={13} /></button><div className="export-menu">{['CSS', 'JSON', 'SCSS', 'Tailwind'].map((format) => <button type="button" key={format} onClick={() => { exportTokens(format); setExportMenuOpen(false) }}>{format} format</button>)}</div></div></PageTitle>
    <Panel title="Studio values" description="Live values from Color Studio, Typography, and Spacing. Check this preview before exporting Figma variables." className="token-review-panel">
      <div className="token-review-grid">
        <section className="token-review-card"><h3>Colors <span>{colors.length}</span></h3>{colors.length ? <div className="token-review-color-list">{colors.map((color, index) => <div className="token-review-color" key={`${color.name}-${color.value}-${index}`}><i style={{ backgroundColor: color.value }} /><span>{color.name}</span><code>{color.value}</code></div>)}</div> : <p className="token-review-empty">No colors set in Color Studio yet.</p>}</section>
        <section className="token-review-card"><h3>Typography</h3><div className="token-review-type" style={{ fontFamily: previewFontFamily, fontSize: `${typography.fontSize}px`, fontWeight: Number(typography.fontWeight), lineHeight: typography.lineHeight, letterSpacing: `${typography.letterSpacing}px`, textTransform: typography.textTransform }}>Aa — Design with intention.</div>{previewFontStatus === 'error' && <p className="token-review-empty" role="status">Could not load {typography.fontFamily}; showing its fallback.</p>}<div className="token-review-meta"><span>Family<strong>{typography.fontFamily}</strong></span><span>Weight<strong>{typography.fontWeight}</strong></span><span>Size<strong>{typography.fontSize}px</strong></span><span>Line height<strong>{typography.lineHeight}</strong></span><span>Letter spacing<strong>{typography.letterSpacing}px</strong></span><span>Case<strong>{typography.textTransform}</strong></span></div></section>
        <section className="token-review-card"><h3>Spacing <span>{spacingSteps.length} steps</span></h3><div className="token-review-spacing">{spacingSteps.map((value, index) => <div className="token-review-space-row" key={`${value}-${index}`}><small>{`space.${index + 1}`}</small><span><i style={{ width: `${Math.min(value * 2, 120)}px` }} /></span><code>{value}px</code></div>)}</div><div className="token-review-meta"><span>Container<strong>{spacing.containerWidth}px</strong></span><span>Columns<strong>{spacing.columns}</strong></span><span>Gutter<strong>{spacing.gutter}px</strong></span><span>Radius<strong>{spacing.borderRadius}px</strong></span></div></section>
      </div>
      <div className="token-review-export"><span>Export uses the current project colors and studio settings shown above.</span><button type="button" className="button-primary" disabled={!project} onClick={exportFigmaVariables}><Download size={15} /> Export Figma Variables JSON</button></div>
    </Panel>
    <div className="token-summary"><div><span className="preview-label">ACTIVE SYSTEM</span><strong>{project?.name}</strong></div><div><span className="preview-label">TOTAL TOKENS</span><strong>{libraryTokens.length}</strong></div><div><span className="preview-label">GROUPS</span><strong>{groupCount} <small>in use</small></strong></div><div className="token-sync"><span /> All changes saved</div></div>
    <Panel title="Token library" description="Search, filter, and manage every design decision."><div className="token-toolbar"><div className="tabs">{tokenGroups.map((item) => <button type="button" className={group === item ? 'tab-active' : ''} key={item} onClick={() => setGroup(item)}>{item}</button>)}</div><label className="token-search"><Search size={14} /><input placeholder="Search tokens..." value={query} onChange={(event) => setQuery(event.target.value)} /></label></div><div className="token-table-wrap"><table className="token-table"><thead><tr><th>Token name</th><th>Value</th><th>Group</th><th>Preview</th><th /></tr></thead><tbody>{visible.map((token) => <tr key={token.name}><td>{token.source === 'studio' ? <div className="token-library-name"><input aria-label={`Studio variable ${token.name}`} className="token-edit token-name-edit token-studio-name" value={token.name} readOnly /><span className="token-source-label">Studio</span></div> : <input aria-label={`Edit token name ${token.name}`} className="token-edit token-name-edit" defaultValue={token.name} onBlur={(event) => { const next = event.target.value.trim(); if (next && (next === token.name || !libraryTokens.some((item) => item.name === next))) updateToken(token.name, { name: next }); else event.target.value = token.name }} />}</td><td><div className="token-value-wrap">{token.source === 'studio' ? <input aria-label={`Studio value for ${token.name}`} className="token-edit" value={token.value} readOnly /> : <input aria-label={`Edit value for ${token.name}`} className="token-edit" value={token.value} onChange={(event) => updateToken(token.name, { value: event.target.value })} />}<button type="button" className="copy-token" aria-label={`Copy ${token.value}`} onClick={() => void copyText(token.value, token.value, notify)}><Copy size={12} /></button></div></td><td><span className="token-group">{token.group}</span></td><td>{token.group === 'Colors' ? <span className="token-color" style={{ backgroundColor: token.value }} /> : <span className="token-preview-text" style={{ fontSize: token.group === 'Typography' ? 15 : undefined, marginLeft: token.group === 'Spacing' ? '12px' : undefined }}>{token.value}</span>}</td><td>{token.source === 'library' && <button type="button" className="icon-button subtle danger-hover" title="Delete token" onClick={() => removeToken(token.name)}><Trash2 size={14} /></button>}</td></tr>)}</tbody></table>{visible.length === 0 && <div className="empty-state">No tokens match your search.</div>}</div></Panel>
    <Panel title="Create token" description="Add a new foundation token to your active system." className="add-token-panel"><form className="create-token-form" onSubmit={createToken}><div><label className="field-label" htmlFor="token-name">Token name</label><input id="token-name" className="field-control" placeholder="e.g. color.brand" value={name} onChange={(event) => setName(event.target.value)} required /></div><div><label className="field-label" htmlFor="token-value">Value</label><input id="token-value" className="field-control" placeholder="e.g. #7C6CFA or 16px" value={value} onChange={(event) => setValue(event.target.value)} required /></div><div><label className="field-label" htmlFor="token-group">Group</label><select id="token-group" className="field-control" value={tokenGroup} onChange={(event) => setTokenGroup(event.target.value)}>{tokenGroups.slice(1).map((item) => <option key={item}>{item}</option>)}</select></div><button className="button-primary" type="submit"><Plus size={15} /> Add token</button></form></Panel>
    {notice && <div className="toast"><span className="toast-check">✓</span>{notice}</div>}</div>
}

export function ProjectsPage() {
  const projects = useDesignStore((state) => state.projects)
  const sortedProjects = [...projects].sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt))
  const activeProjectId = useDesignStore((state) => state.activeProjectId)
  const addProject = useDesignStore((state) => state.addProject)
  const renameProject = useDesignStore((state) => state.renameProject)
  const duplicateProject = useDesignStore((state) => state.duplicateProject)
  const deleteProject = useDesignStore((state) => state.deleteProject)
  const setActiveProject = useDesignStore((state) => state.setActiveProject)
  const replaceProjects = useDesignStore((state) => state.replaceProjects)
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { notice, notify } = useNotice()
  const createProject = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    addProject(name.trim())
    setName('')
    notify('Design system created; syncing to Firebase')
  }
  const importFile = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result))
        if (isWorkspaceBackup(parsed)) {
          if (!window.confirm(`Restore ${parsed.projects.length} projects from this backup? This replaces the current workspace.`)) return
          const activeId = parsed.projects.some((project) => project.id === parsed.activeProjectId)
            ? parsed.activeProjectId
            : (parsed.projects[0]?.id ?? '')
          replaceProjects(parsed.projects.map(normalizeProject), activeId)
          notify(`Workspace restored · ${parsed.projects.length} project${parsed.projects.length === 1 ? '' : 's'} · syncing to Firebase`)
          return
        }
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isDesignProject)) {
          if (!window.confirm(`Import ${parsed.length} projects and replace the current workspace?`)) return
          const restored = parsed.map(normalizeProject)
          replaceProjects(restored, restored[0].id)
          notify(`${parsed.length} projects restored · syncing to Firebase`)
          return
        }
        if (isDesignProject(parsed)) {
          const alreadyExists = projects.some((project) => project.id === parsed.id)
          const restored = normalizeProject(parsed)
          replaceProjects([restored, ...projects.filter((project) => project.id !== restored.id)])
          notify(`${alreadyExists ? `${parsed.name} configuration restored` : `${parsed.name} imported`} · syncing to Firebase`)
          return
        }
        notify('Could not import: this is not a valid DesignBoost project or workspace backup')
      } catch {
        notify('Could not import: the JSON file is invalid or unreadable')
      }
    }
    reader.readAsText(file)
  }
  return <div className="page"><PageTitle eyebrow="WORKSPACE / PROJECTS" title="Your projects" description="Manage design systems for every product and team."><label className="button-secondary file-button"><Upload size={15} /> Restore / import JSON<input type="file" accept="application/json,.json" onChange={(event) => { importFile(event.target.files?.[0]); event.currentTarget.value = '' }} /></label></PageTitle>
    <form className="create-project-bar" onSubmit={createProject}><span className="new-project-icon"><Plus size={18} /></span><div><strong>Start a new design system</strong><small>Set up a shared foundation for your next product.</small></div><input ref={inputRef} className="field-control" placeholder="Name your project..." value={name} onChange={(event) => setName(event.target.value)} required /><button className="button-primary" type="submit"><Plus size={15} /> Create</button></form>
    <div className="projects-heading"><div><h2>All projects <span>{projects.length}</span></h2><p>Saved to your Firebase account</p></div><span className="select-small">Sorted by last modified</span></div>
    <div className="projects-grid">{sortedProjects.map((project) => <article className={`project-card ${activeProjectId === project.id ? 'current' : ''}`} key={project.id}><div className="project-card-art"><div className="project-art-swatches">{project.colors.length ? project.colors.slice(0, 5).map((color) => <i key={color.name} style={{ background: color.value }} title={color.name} />) : <span>No colors added yet</span>}</div><button className="icon-button art-menu" title="More project actions" onClick={(event) => event.currentTarget.parentElement?.classList.toggle('menu-open')}><MoreHorizontal size={17} /></button><div className="project-menu"><button onClick={() => { const next = window.prompt('Rename design system', project.name); if (next?.trim()) { renameProject(project.id, next.trim()); notify('Project renamed; syncing to Firebase') } }}>Rename</button><button onClick={() => { duplicateProject(project.id); notify('Project duplicated; syncing to Firebase') }}>Duplicate</button><button className="danger-text" onClick={() => { if (window.confirm(`Delete “${project.name}”? This cannot be undone.`)) { deleteProject(project.id); notify('Project deleted; syncing to Firebase') } }}>Delete</button></div></div><div className="project-card-body"><div className="project-card-title"><h3>{project.name}</h3>{activeProjectId === project.id && <span className="active-badge">Active</span>}</div><p>{project.colors.length} colors <i /> {project.tokens.length} tokens <i /> Edited {new Date(project.updatedAt).toLocaleDateString()}</p><div className="project-card-bottom"><div className="mini-palette">{project.colors.slice(0, 6).map((color) => <i key={color.name} style={{ background: color.value }} />)}</div><button className="button-secondary compact" onClick={() => { setActiveProject(project.id); notify(`${project.name} is now active`) }}>Open project <ArrowRight size={13} /></button></div></div></article>)}</div>
    {notice && <div className="toast"><span className="toast-check">✓</span>{notice}</div>}</div>
}

export function SavedSystemsPage() {
  const projects = useDesignStore((state) => state.projects)
  const active = useDesignStore((state) => state.activeProjectId)
  const setActive = useDesignStore((state) => state.setActiveProject)
  return <div className="page"><PageTitle eyebrow="WORKSPACE / LIBRARY" title="Saved systems" description="Your reusable design foundations, ready to bring into any project." /><div className="saved-system-grid">{projects.map((project) => <button className={`saved-system-card ${active === project.id ? 'selected' : ''}`} key={project.id} onClick={() => setActive(project.id)}><div className="saved-system-colors">{project.colors.slice(0, 5).map((color) => <i key={color.name} style={{ background: color.value }} />)}</div><strong>{project.name}</strong><span>{project.tokens.length} tokens · {project.colors.length} colors</span><div className="saved-system-footer"><span>{active === project.id ? 'Currently active' : 'Click to switch system'}</span><ArrowRight size={14} /></div></button>)}</div><div className="info-banner"><Sparkles size={16} /><span>Your systems sync to Firebase for access across devices. Export a JSON backup from the top bar for an offline copy.</span></div></div>
}

export function SettingsPage() {
  const projects = useDesignStore((state) => state.projects)
  const active = useDesignStore((state) => state.projects.find((project) => project.id === state.activeProjectId))
  const workspaceName = useDesignStore((state) => state.workspaceName)
  const setWorkspaceName = useDesignStore((state) => state.setWorkspaceName)
  const compact = useDesignStore((state) => state.compactDensity)
  const setCompact = useDesignStore((state) => state.setCompactDensity)
  const theme = useDesignStore((state) => state.theme)
  const setTheme = useDesignStore((state) => state.setTheme)
  const { notice, notify } = useNotice()
  useEffect(() => {
    document.documentElement.classList.toggle('compact-density', compact)
  }, [compact])
  const editWorkspaceName = () => {
    const nextName = window.prompt('Workspace name', workspaceName)
    if (nextName === null) return
    if (!nextName.trim()) {
      notify('Workspace name cannot be empty')
      return
    }
    setWorkspaceName(nextName.trim())
    notify('Workspace name saved')
  }
  return <div className="page">
    <PageTitle eyebrow="WORKSPACE / PREFERENCES" title="Settings" description="Make your workspace feel like yours." />
    <div className="settings-page-grid">
      <div className="settings-main">
        <Panel title="Workspace profile" description="The basics of your DesignBoost workspace.">
          <div className="settings-profile">
            <span className="settings-avatar">D</span>
            <div><strong>{workspaceName}</strong><small>Personal workspace · {projects.length} projects</small></div>
            <button type="button" className="button-secondary" onClick={editWorkspaceName}>Edit profile</button>
          </div>
          <div className="settings-row">
            <div><b>Active design system</b><small>Default project for new design work.</small></div>
            <select className="field-control" value={active?.id ?? ''} disabled={!projects.length} onChange={(event) => useDesignStore.getState().setActiveProject(event.target.value)}>
              {projects.length ? projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>) : <option value="">No projects yet</option>}
            </select>
          </div>
        </Panel>
        <Panel title="Preferences" description="Configure how DesignBoost behaves.">
          <div className="settings-row">
            <div><b>Appearance</b><small>Choose a workspace color theme.</small></div>
            <div className="theme-choices" role="group" aria-label="Appearance">
              <button type="button" className={theme === 'light' ? 'selected' : ''} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><Sun size={14} />Light</button>
              <button type="button" className={theme === 'dark' ? 'selected' : ''} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><Moon size={14} />Dark</button>
            </div>
          </div>
          <div className="settings-row">
            <div><b>Compact density</b><small>Reduce spacing across panels and tables.</small></div>
            <button type="button" className={`toggle-switch ${compact ? 'on' : ''}`} aria-label="Toggle compact density" aria-pressed={compact} onClick={() => setCompact(!compact)}><i /></button>
          </div>
          <div className="settings-row">
            <div><b>Firebase sync</b><small>Project changes are synced to your signed-in account.</small></div>
            <span className="preference-status"><i />On</span>
          </div>
        </Panel>
      </div>
      <aside className="settings-side">
        <Panel title="About" description="A little about this workspace.">
          <div className="about-row"><span>Application</span><b>DesignBoost AI</b></div>
          <div className="about-row"><span>Version</span><b>1.0.0</b></div>
          <div className="about-row"><span>Storage</span><b>Firebase Cloud Firestore</b></div>
          <div className="recommendation"><Sparkles size={15} /><span><b>Your work stays yours</b><small>Your projects are private to your Google account and backed by a local browser copy.</small></span></div>
        </Panel>
      </aside>
    </div>
    {notice && <div className="toast"><span className="toast-check">✓</span>{notice}</div>}
  </div>
}
