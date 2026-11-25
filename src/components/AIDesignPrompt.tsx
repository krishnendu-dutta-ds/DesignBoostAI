import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, KeyRound, LoaderCircle, Plus, Sparkles } from 'lucide-react'
import { useDesignStore } from '../store/useDesignStore'
import { useGeminiKey } from '../firebase/geminiKey'
import { generateDesignSystem, type GeneratedDesignSystem } from '../utils/gemini'

export function AIDesignPrompt({ notify }: { notify: (message: string) => void }) {
  const projects = useDesignStore((state) => state.projects)
  const activeProjectId = useDesignStore((state) => state.activeProjectId)
  const applyGeneratedDesign = useDesignStore((state) => state.applyGeneratedDesign)
  const apiKey = useGeminiKey((state) => state.apiKey)
  const enabled = useGeminiKey((state) => state.enabled)
  const keyStatus = useGeminiKey((state) => state.status)
  const keyError = useGeminiKey((state) => state.error)
  const loadKey = useGeminiKey((state) => state.load)
  const setEnabled = useGeminiKey((state) => state.setEnabled)
  const [prompt, setPrompt] = useState('')
  const [targetProjectId, setTargetProjectId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [activating, setActivating] = useState(false)
  const [draft, setDraft] = useState<GeneratedDesignSystem | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { void loadKey() }, [loadKey])

  const project = projects.find((item) => item.id === targetProjectId)
    ?? projects.find((item) => item.id === activeProjectId)
    ?? projects[0]

  const activate = async () => {
    setActivating(true)
    setError('')
    try {
      await setEnabled(true)
      notify('AI generation activated')
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : 'Could not activate AI generation.')
    } finally {
      setActivating(false)
    }
  }

  const generate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!project || !prompt.trim()) return
    setGenerating(true)
    setError('')
    try {
      const generated = await generateDesignSystem(apiKey, prompt.trim(), project.name)
      setDraft(generated)
      notify(`${generated.name} generated, review it below`)
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Design generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  const applyDraft = () => {
    if (!draft || !project) return
    const added = applyGeneratedDesign(project.id, draft)
    setDraft(null)
    setPrompt('')
    notify(`${draft.name} applied to ${project.name} · ${added} new tokens`)
  }

  return <section className="panel ai-token-panel ai-prompt-panel">
    <div className="panel-heading">
      <div><h2>AI design prompt</h2><p>Generate a complete design system — colors, typography, spacing and tokens — from one prompt instead of building it by hand.</p></div>
      {apiKey && enabled && <span className="preference-status"><i />AI active</span>}
    </div>
    {!apiKey ? <div className="ai-key-missing">
      <KeyRound size={17} />
      <div><b>Add your Gemini API key</b><small>{keyStatus === 'loading' ? 'Checking your saved key…' : keyError || 'Each signed-in user connects their own key. It is stored privately in your account.'}</small></div>
      <Link className="button-secondary compact" to="/settings">Open settings <ArrowRight size={13} /></Link>
    </div> : !enabled ? <div className="ai-key-missing">
      <Sparkles size={17} />
      <div><b>Activate AI generation</b><small>Your key is saved. Activate AI for this account to open the prompt panel and generate full design systems.</small></div>
      <button className="button-primary compact" type="button" disabled={activating} onClick={() => void activate()}>{activating ? 'Activating…' : 'Activate AI'}</button>
    </div> : !project ? <div className="ai-key-missing">
      <KeyRound size={17} />
      <div><b>Create a project first</b><small>Generated designs are applied to a project, so you need at least one project.</small></div>
      <Link className="button-secondary compact" to="/projects">Open projects <ArrowRight size={13} /></Link>
    </div> : <>
      <form className="ai-prompt-form" onSubmit={generate}>
        <div className="ai-prompt-grid">
          <div>
            <label className="field-label" htmlFor="ai-design-project">Apply to project</label>
            <select id="ai-design-project" className="field-control" value={project.id} onChange={(event) => setTargetProjectId(event.target.value)}>{projects.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
            <p className="field-hint">The generated design is written to this project by name.</p>
          </div>
          <div>
            <label className="field-label" htmlFor="ai-design-prompt">Prompt</label>
            <textarea id="ai-design-prompt" className="field-control ai-prompt-input" rows={3} maxLength={800} placeholder="e.g. A calm editorial fintech system with deep green brand colors, Inter type, generous spacing and softly rounded cards." value={prompt} onChange={(event) => setPrompt(event.target.value)} />
          </div>
        </div>
        <div className="ai-prompt-actions">
          <small>Gemini returns a full system: a palette, type scale, spacing, radius and tokens — all cleaned and ready to apply.</small>
          <button className="button-primary" type="submit" disabled={generating || !prompt.trim()}>{generating ? <><LoaderCircle size={15} className="firebase-spinner" /> Generating…</> : <><Sparkles size={15} /> Generate design system</>}</button>
        </div>
      </form>
      {error && <div className="firebase-auth-error" role="alert">{error}</div>}
      {draft && <div className="ai-generated">
        <div className="ai-generated-head"><div><strong>{draft.name}</strong><small>{draft.description || 'Generated from your prompt'}</small></div><span className="token-group">{project.name}</span></div>
        <div className="ai-design-summary">
          <div>
            <span className="preview-label">COLORS</span>
            <div className="ai-design-swatches">{draft.colors.map((color) => <i key={color.name} style={{ backgroundColor: color.value }} title={`${color.name} ${color.value}`} />)}</div>
            <small>{draft.colors.length} colors</small>
          </div>
          <div>
            <span className="preview-label">TYPEFACE</span>
            <strong>{draft.typography.fontFamily}</strong>
            <small>{draft.typography.fontWeight} · {draft.typography.fontSize}px / {draft.typography.lineHeight}</small>
          </div>
          <div>
            <span className="preview-label">SPACING</span>
            <strong>{draft.spacing.baseUnit}px base</strong>
            <small>{draft.spacing.columns} columns · {draft.spacing.gutter}px gutter · {draft.spacing.borderRadius}px radius</small>
          </div>
        </div>
        <ul className="ai-token-list">{draft.tokens.map((token) => <li key={token.name}>{token.group === 'Colors' ? <i style={{ backgroundColor: token.value }} /> : <i className="ai-token-mark" />}<code>{token.name}</code><span>{token.value}</span><b>{token.group}</b></li>)}</ul>
        <div className="ai-generated-foot"><span>Applying replaces this project's colors, type and spacing, then adds the generated tokens.</span><div className="ai-generated-actions"><button className="button-secondary compact" type="button" onClick={() => setDraft(null)}>Discard</button><button className="button-primary compact" type="button" onClick={applyDraft}><Plus size={14} /> Apply to {project.name}</button></div></div>
      </div>}
    </>}
  </section>
}
