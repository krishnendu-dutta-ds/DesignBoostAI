import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Copy, Search } from 'lucide-react'
import {
  GOOGLE_FONTS,
  getFontFamilyStack,
  getGoogleFontCss,
  getGoogleFontSpecimenUrl,
  getGoogleFontUrl,
  getNearestGoogleFontWeight,
  type GoogleFont,
} from '../utils/googleFonts'

type ProjectUse = 'Any project' | 'Product interface' | 'Editorial' | 'Brand / display' | 'Code / data'

const useCaseCategories: Record<Exclude<ProjectUse, 'Any project'>, string[]> = {
  'Product interface': ['Sans Serif', 'Monospace'],
  Editorial: ['Serif', 'Sans Serif'],
  'Brand / display': ['Display', 'Handwriting', 'Serif'],
  'Code / data': ['Monospace'],
}

type GoogleFontPickerProps = {
  projectName: string
  selectedFamily: string
  selectedWeight: string
  onSelect: (font: GoogleFont, weight: string) => void
  onWeightsChange: (weights?: number[]) => void
  notify: (message: string) => void
}

export function GoogleFontPicker({ projectName, selectedFamily, selectedWeight, onSelect, onWeightsChange, notify }: GoogleFontPickerProps) {
  const [query, setQuery] = useState('')
  const [useCase, setUseCase] = useState<ProjectUse>('Any project')
  const [category, setCategory] = useState('All categories')
  const [visibleCount, setVisibleCount] = useState(48)
  const [sample, setSample] = useState('The quick brown fox jumps over the lazy dog.')
  const [fontStatus, setFontStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const selectedFont = GOOGLE_FONTS.find((item) => item.family === selectedFamily)
  const categories = useMemo(() => [...new Set(GOOGLE_FONTS.map((font) => font.category))].sort(), [])
  const filteredFonts = useMemo(() => {
    const search = query.trim().toLowerCase()
    const recommendedCategories = useCase === 'Any project' ? undefined : useCaseCategories[useCase]
    return GOOGLE_FONTS
      .filter((font) => !search || font.family.toLowerCase().includes(search))
      .filter((font) => category === 'All categories' || font.category === category)
      .filter((font) => !recommendedCategories || recommendedCategories.includes(font.category))
      .sort((a, b) => a.popularity - b.popularity || a.family.localeCompare(b.family))
  }, [category, query, useCase])

  useEffect(() => setVisibleCount(48), [category, query, useCase])
  useEffect(() => onWeightsChange(selectedFont?.weights), [onWeightsChange, selectedFont])

  useEffect(() => {
    if (!selectedFont) {
      setFontStatus('ready')
      return
    }

    let active = true
    setFontStatus('loading')
    const stylesheet = document.createElement('link')
    stylesheet.rel = 'stylesheet'
    stylesheet.href = getGoogleFontUrl(selectedFont)
    stylesheet.onload = () => { if (active) setFontStatus('ready') }
    stylesheet.onerror = () => { if (active) setFontStatus('error') }
    document.head.appendChild(stylesheet)
    return () => {
      active = false
      stylesheet.remove()
    }
  }, [selectedFont])

  const copyValue = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      notify(`${label} copied`)
    } catch {
      notify('Clipboard access failed. Select the text and copy it manually.')
    }
  }

  const chooseFont = (font: GoogleFont) => onSelect(font, getNearestGoogleFontWeight(font, selectedWeight))
  const familyStack = getFontFamilyStack(selectedFamily, selectedFont?.category)

  return <section className="panel google-font-picker" aria-labelledby="google-font-heading">
    <div className="panel-heading">
      <div><h2 id="google-font-heading">Google Fonts library</h2><p>{GOOGLE_FONTS.length.toLocaleString()} families · filter by project use and category</p></div>
      <span className="font-project-label">{projectName}</span>
    </div>
    <div className="google-font-filters">
      <label className="google-font-search"><Search size={14} /><input aria-label="Search Google Fonts" placeholder={`Search ${GOOGLE_FONTS.length.toLocaleString()} families...`} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <select aria-label="Filter by project use case" className="field-control" value={useCase} onChange={(event) => setUseCase(event.target.value as ProjectUse)}>
        {(['Any project', 'Product interface', 'Editorial', 'Brand / display', 'Code / data'] as ProjectUse[]).map((value) => <option key={value}>{value}</option>)}
      </select>
      <select aria-label="Filter by font category" className="field-control" value={category} onChange={(event) => setCategory(event.target.value)}>
        <option>All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}
      </select>
    </div>
    <p className="google-font-hint">Use-case suggestions are based on Google Fonts categories; results are ranked by Google Fonts popularity.</p>
    <div className="google-font-browser">
      <div className="google-font-results" aria-label="Google font families">
        {filteredFonts.slice(0, visibleCount).map((font) => <button
          type="button"
          aria-pressed={selectedFamily === font.family}
          className={`google-font-option ${selectedFamily === font.family ? 'selected' : ''}`}
          key={font.family}
          onClick={() => chooseFont(font)}
        >
          <span className="google-font-option-copy"><strong>{font.family}</strong><small>{font.category} · {font.weights.length} weights{font.variable ? ' · variable' : ''}</small></span>
          <span className="google-font-rank">#{font.popularity}</span>
        </button>)}
        {filteredFonts.length === 0 && <div className="empty-state">No Google Fonts match these filters.</div>}
      </div>
      <div className="google-font-detail">
        <div className="google-font-selected">
          <div className="preview-label">SELECTED FOR THIS PROJECT</div>
          <h3 style={{ fontFamily: familyStack }}>{selectedFamily}</h3>
          <p>{selectedFont ? `${selectedFont.category} · ${selectedFont.weights.length} weights${selectedFont.variable ? ' · variable font' : ''}` : 'Custom or system font'}</p>
          <small>{fontStatus === 'loading' ? 'Loading live preview…' : fontStatus === 'error' ? 'Google Fonts could not load; preview uses its fallback.' : 'Live preview ready'}</small>
        </div>
        <label className="google-font-sample-field">Preview text<input value={sample} onChange={(event) => setSample(event.target.value)} /></label>
        <div className="google-font-live-sample" style={{ fontFamily: familyStack }}>{sample || 'Your font preview'}</div>
        <div className="google-font-links">
          {selectedFont && <a className="font-text-link" href={getGoogleFontSpecimenUrl(selectedFont)} target="_blank" rel="noreferrer">Open Google Fonts <ArrowUpRight size={13} /></a>}
          <button type="button" onClick={() => void copyValue('Font family', familyStack)}><Copy size={12} /> Copy family</button>
          <button type="button" disabled={!selectedFont} onClick={() => selectedFont && void copyValue('Google Fonts link', getGoogleFontUrl(selectedFont))}><Copy size={12} /> Copy link</button>
          <button type="button" disabled={!selectedFont} onClick={() => selectedFont && void copyValue('Font CSS', getGoogleFontCss(selectedFont))}><Copy size={12} /> Copy CSS</button>
        </div>
        {selectedFont && <pre className="google-font-css-preview"><code>{getGoogleFontCss(selectedFont)}</code></pre>}
      </div>
    </div>
    {filteredFonts.length > visibleCount && <button className="button-secondary google-font-more" onClick={() => setVisibleCount((count) => count + 48)}>Show more fonts <span>{visibleCount} of {filteredFonts.length.toLocaleString()}</span></button>}
  </section>
}
