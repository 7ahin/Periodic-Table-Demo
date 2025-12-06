'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js'
import { Easing, Tween, update as tweenUpdate } from '@tweenjs/tween.js'
import Script from 'next/script'

export default function Page() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef<{ camera: THREE.PerspectiveCamera, scene: THREE.Scene, renderer: CSS3DRenderer, objects: THREE.Object3D[], targets: Record<string, THREE.Object3D[]> } | null>(null)
  const [authed, setAuthed] = useState(false)
  const [view, setView] = useState<'table'|'sphere'|'helix'|'grid'>('table')
  const viewRef = useRef(view)
  const [selected, setSelected] = useState<{ id:string; name:string; company:string; networthVal:number; networth?:string } | null>(null)
  const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID as string
  const SPREADSHEET_ID = process.env.NEXT_PUBLIC_SPREADSHEET_ID as string
  const RANGE = (process.env.NEXT_PUBLIC_SHEET_RANGE as string) || 'Sheet1'
  const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly'
  let accessToken: string | null = null
  let tokenClient: google.accounts.oauth2.TokenClient | null = null

  

  const initThree = useCallback(() => {
    const container = containerRef.current!
    const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000)
    {
      const base = Math.min(window.innerWidth, window.innerHeight)
      const mobile = window.innerWidth <= 768
      camera.position.z = mobile
        ? Math.max(2000, Math.min(2800, base * 3.2))
        : Math.max(2400, Math.min(3600, base * 4))
    }
    const scene = new THREE.Scene()
    const renderer = new CSS3DRenderer()
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.domElement.style.position = 'absolute'
    container.innerHTML = ''
    container.appendChild(renderer.domElement)
    stateRef.current = { camera, scene, renderer, objects: [], targets: { table: [], sphere: [], helix: [], grid: [] } }
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      const base = Math.min(window.innerWidth, window.innerHeight)
      const mobileCam = window.innerWidth <= 768
      camera.position.z = mobileCam
        ? Math.max(2000, Math.min(2800, base * 3.2))
        : Math.max(2400, Math.min(3600, base * 4))
      const s = stateRef.current!
      let tileW = cssPxVar('--tile-w'), tileH = cssPxVar('--tile-h')
      if (!tileW || !tileH) { tileW = 140; tileH = 160 }
      const total = s.objects.length
      const viewportMin = Math.min(window.innerWidth, window.innerHeight)
      s.targets = { table: [], sphere: [], helix: [], grid: [] }
      for (let i = 0; i < total; i++) {
        const x = (i % 20) * (tileW + 20) - (20 * (tileW + 20) / 2)
        const y = (Math.floor(i / 20) % 10) * (tileH + 20) - (10 * (tileH + 20) / 2)
        const t = new THREE.Object3D()
        t.position.set(x, -y, 0)
        s.targets.table.push(t)

        const phi = Math.acos(-1 + (2 * i) / total)
        const theta = Math.sqrt(total * Math.PI) * phi
        const desktop = window.innerWidth >= 1024
        const r = desktop
          ? Math.min(1000, viewportMin * 0.95)
          : Math.max(260, Math.min(640, viewportMin * 0.6))
        const sObj = new THREE.Object3D()
        sObj.position.set(
          r * Math.cos(theta) * Math.sin(phi),
          r * Math.sin(theta) * Math.sin(phi),
          r * Math.cos(phi)
        )
        sObj.lookAt(new THREE.Vector3(0,0,0))
        s.targets.sphere.push(sObj)

        const mobile = window.innerWidth <= 768
        const helixRadius = mobile ? Math.max(220, Math.min(340, viewportMin * 0.45)) : Math.max(420, Math.min(650, viewportMin * 0.6))
        const helixTurns = 8
        const tFactor = i / total
        const angle = tFactor * Math.PI * 2 * helixTurns
        const strand = i % 2 === 0 ? 1 : -1
        const helixX = helixRadius * Math.cos(angle) * 0.8
        const helixZ = helixRadius * Math.sin(angle) * 0.8
        const helixObj = new THREE.Object3D()
        helixObj.position.set(strand * helixX, (i - total/2) * 12, strand * helixZ)
        helixObj.lookAt(new THREE.Vector3(0, (i - total/2) * 12, 0))
        s.targets.helix.push(helixObj)

        const gx = 5, gy = 4, gz = 10
        const ix = i % gx
        const iy = Math.floor(i / gx) % gy
        const iz = Math.floor(i / (gx * gy)) % gz
        const spacingX = tileW + 40
        const spacingY = tileH + 40
        const spacingZ = mobile ? 260 : 420
        const gridObj = new THREE.Object3D()
        gridObj.position.set(
          (ix - (gx - 1) / 2) * spacingX,
          (iy - (gy - 1) / 2) * spacingY,
          (iz - (gz - 1) / 2) * spacingZ
        )
        s.targets.grid.push(gridObj)
      }
      const currentView = viewRef.current || 'table'
      transform(s.targets[currentView], 600)
    }
    window.addEventListener('resize', handleResize)
  }, [])

  async function fetchSheet() {
    if (!SPREADSHEET_ID) { alert('Missing NEXT_PUBLIC_SPREADSHEET_ID'); return }
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/`
    const bare = (RANGE || '').split('!')[0].trim()
    const candidates = [] as string[]
    if (RANGE && RANGE.trim()) candidates.push(RANGE.trim())
    if (bare) {
      candidates.push(`${bare}!A1:Z1000`, `${bare}!A1:Z`, bare)
    }
    candidates.push('A1:Z1000', 'A1:Z')
    let rows: string[][] | null = null
    let lastStatus = 0
    let lastText = ''
    let lastUrl = ''
    for (const r of candidates) {
      const url = base + encodeURIComponent(r) + '?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE'
      lastUrl = url
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } })
      if (res.ok) {
        const obj = await res.json()
        rows = (obj.values || []) as string[][]
        break
      } else {
        lastStatus = res.status
        lastText = await res.text()
      }
    }
    if (!rows) {
      let message = lastText
      try {
        const j = JSON.parse(lastText)
        if (j && j.error && j.error.message) message = j.error.message
      } catch {}
      if (lastStatus === 400) {
        const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties.title`
        const metaRes = await fetch(metaUrl, { headers: { Authorization: 'Bearer ' + accessToken } })
        if (metaRes.ok) {
          type SheetMeta = { sheets?: { properties?: { title?: string } }[] }
          const meta: SheetMeta = await metaRes.json()
          const titles: string[] = (meta.sheets ?? [])
            .map(s => s.properties?.title || '')
            .filter((t): t is string => typeof t === 'string' && t.length > 0)
          const fallbackTitle = titles.includes(bare) ? bare : (titles.includes('Sheet1') ? 'Sheet1' : (titles[0] || ''))
          if (fallbackTitle) {
            const url = base + encodeURIComponent(`${fallbackTitle}!A1:Z1000`) + '?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE'
            lastUrl = url
            const res2 = await fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } })
            if (res2.ok) {
              const obj2 = await res2.json()
              rows = (obj2.values || []) as string[][]
            } else {
              lastStatus = res2.status
              lastText = await res2.text()
              message = lastText
              try {
                const j2 = JSON.parse(lastText)
                if (j2 && j2.error && j2.error.message) message = j2.error.message
              } catch {}
            }
          }
        }
      }
      if (!rows) {
        alert('Sheets API error ' + lastStatus + ': ' + message + '\nURL: ' + lastUrl)
        return
      }
    }
    const data = parseRows(rows)
    buildScene(data)
  }

  function parseRows(rows: string[][]) {
    if (!rows || rows.length < 1) return [] as { id:string; name:string; company:string; networthVal:number; networth?:string }[]
    const headers = rows[0].map(h => h ? h.toString().trim() : '')
    type Canon = 'id' | 'name' | 'title' | 'company' | 'networth'
    const hdrMap: Record<number, Canon | undefined> = {}
    const canonical: Record<Canon, string[]> = {
      id: ['id','rank','no','number'],
      name: ['name','full name','person'],
      title: ['title','role','position'],
      company: ['company','organization','org'],
      networth: ['networth','net worth','worth','wealth']
    }
    headers.forEach((h, idx) => {
      const lh = h.toLowerCase()
      const entries = Object.entries(canonical) as [Canon, string[]][]
      for (const [canonKey, arr] of entries) {
        if (arr.some(s => lh.includes(s))) { hdrMap[idx] = canonKey; break }
      }
      if (!hdrMap[idx] && lh === 'name') hdrMap[idx] = 'name'
    })
    const out: { id:string; name:string; company:string; networthVal:number; networth?:string }[] = []
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]
      const obj: { id:string; name:string; title:string; company:string; networth:string; networthVal:number } = { id:'', name:'', title:'', company:'', networth:'', networthVal:0 }
      for (let c = 0; c < headers.length; c++) {
        const canon = hdrMap[c]
        const val = row[c] ?? ''
        if (canon) obj[canon] = val
        else if (c === 0 && !obj.name) obj.name = val
      }
      if (obj.networth) {
        const num = obj.networth.toString().replace(/[^0-9.-]+/g,'')
        obj.networthVal = parseFloat(num) || 0
      }
      if (!obj.company) obj.company = obj.title || ''
      out.push({ id: obj.id || '', name: obj.name || '', company: obj.company || '', networthVal: obj.networthVal, networth: obj.networth })
    }
    return out
  }

  function cssPxVar(name: string) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return parseFloat(v.replace('px','')) || 0
  }

  function buildScene(data: { id: string; name: string; company: string; networthVal: number }[]) {
    const s = stateRef.current!
    s.objects = []
    s.targets = { table: [], sphere: [], helix: [], grid: [] }
    let tileW = cssPxVar('--tile-w'), tileH = cssPxVar('--tile-h')
    if (!tileW || !tileH) { tileW = 140; tileH = 160 }
    const total = Math.max(200, data.length)
    const padded = [...data]
    while (padded.length < total) padded.push({ id: '', name: '', company: '', networthVal: 0 })
    const viewportMin = Math.min(window.innerWidth, window.innerHeight)

    for (let i = 0; i < total; i++) {
      const d = padded[i]
      const el = document.createElement('div')
      el.className = 'element'
      const v = d.networthVal || 0
      let bg = '#ff6b6b'
      if (v >= 200000) bg = '#66cc66'
      else if (v >= 100000) bg = '#ffb84d'
      el.style.background = bg
      function hexToRgb(h: string) {
        const s = h.replace('#','')
        const n = parseInt(s, 16)
        if (s.length === 6) return { r: (n>>16)&255, g: (n>>8)&255, b: n&255 }
        return { r: 255, g: 255, b: 255 }
      }
      const rgb = hexToRgb(bg)
      const glow = `rgba(${rgb.r},${rgb.g},${rgb.b},0.6)`
      el.style.setProperty('--glow', glow)
      el.innerHTML = `
        <div class="tile">
          <div class="rank">${d.id || i + 1}</div>
          <div class="title">${d.name || '—'}</div>
          <div class="company">${d.company || ''}</div>
          <div class="worth">${d.networthVal ? ('$' + Number(d.networthVal).toLocaleString()) : ''}</div>
        </div>
      `
      el.style.cursor = 'pointer'
      el.addEventListener('click', () => {
        setSelected({ id: String(d.id || i + 1), name: d.name || '', company: d.company || '', networthVal: d.networthVal || 0 })
      })
      const obj = new CSS3DObject(el)
      obj.position.x = Math.random() * 4000 - 2000
      obj.position.y = Math.random() * 4000 - 2000
      obj.position.z = Math.random() * 4000 - 2000
      s.scene.add(obj)
      s.objects.push(obj)

      const x = (i % 20) * (tileW + 20) - (20 * (tileW + 20) / 2)
      const y = (Math.floor(i / 20) % 10) * (tileH + 20) - (10 * (tileH + 20) / 2)
      const t = new THREE.Object3D()
      t.position.set(x, -y, 0)
      s.targets.table.push(t)

      const total = padded.length
      const phi = Math.acos(-1 + (2 * i) / total)
      const theta = Math.sqrt(total * Math.PI) * phi
      const desktop = window.innerWidth >= 1024
      const r = desktop
        ? Math.min(1000, viewportMin * 0.95)
        : Math.max(260, Math.min(640, viewportMin * 0.6))
      const sObj = new THREE.Object3D()
      sObj.position.set(
        r * Math.cos(theta) * Math.sin(phi),
        r * Math.sin(theta) * Math.sin(phi),
        r * Math.cos(phi)
      )
      sObj.lookAt(new THREE.Vector3(0,0,0))
      s.targets.sphere.push(sObj)

      const mobile = window.innerWidth <= 768
      const helixRadius = mobile ? Math.max(220, Math.min(340, viewportMin * 0.45)) : Math.max(420, Math.min(650, viewportMin * 0.6))
      const helixTurns = 8
      const tFactor = i / total
      const angle = tFactor * Math.PI * 2 * helixTurns
      const strand = i % 2 === 0 ? 1 : -1
      const helixX = helixRadius * Math.cos(angle) * 0.8
      const helixZ = helixRadius * Math.sin(angle) * 0.8
      const helixObj = new THREE.Object3D()
      helixObj.position.set(strand * helixX, (i - total/2) * 12, strand * helixZ)
      helixObj.lookAt(new THREE.Vector3(0, (i - total/2) * 12, 0))
      s.targets.helix.push(helixObj)

      const gx = 5, gy = 4, gz = 10
      const ix = i % gx
      const iy = Math.floor(i / gx) % gy
      const iz = Math.floor(i / (gx * gy)) % gz
      const spacingX = tileW + 40
      const spacingY = tileH + 40
      const spacingZ = mobile ? 260 : 420
      const gridObj = new THREE.Object3D()
      gridObj.position.set(
        (ix - (gx - 1) / 2) * spacingX,
        (iy - (gy - 1) / 2) * spacingY,
        (iz - (gz - 1) / 2) * spacingZ
      )
      s.targets.grid.push(gridObj)
    }
    transform(s.targets.table, 2000)
    setView('table')
    animate()
  }

  function transform(targetArray: THREE.Object3D[], duration: number) {
    const s = stateRef.current!
    for (let i = 0; i < s.objects.length; i++) {
      const obj = s.objects[i]
      const target = targetArray[i] || new THREE.Object3D()
      new Tween(obj.position)
        .to({ x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * duration + duration)
        .easing(Easing.Exponential.InOut)
        .start()
      new Tween(obj.rotation)
        .to({ x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }, Math.random() * duration + duration)
        .easing(Easing.Exponential.InOut)
        .start()
    }
  }

  function animate() {
    const s = stateRef.current!
    function loop() {
      requestAnimationFrame(loop)
      tweenUpdate()
      s.renderer.render(s.scene, s.camera)
    }
    loop()
  }

  

  function initTokenClient() {
    if (typeof window === 'undefined' || !('google' in window)) { alert('Google Identity library not loaded'); return }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp: google.accounts.oauth2.TokenResponse) => {
        if (resp.error) {
          const msg = resp.error_description || resp.error
          alert(msg || 'OAuth error')
          return
        }
        accessToken = resp.access_token ?? null
        setAuthed(true)
        fetchSheet()
      }
    })
  }

  function requestAccessToken() {
    if (!CLIENT_ID) { alert('Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID'); return }
    if (!tokenClient) initTokenClient()
    if (!tokenClient) { alert('Google Identity not ready'); return }
    try {
      tokenClient.requestAccessToken({ prompt: 'consent' })
    } catch {
      alert('Login popup blocked. Allow pop-ups and third-party cookies, or try a different browser.')
    }
  }

  useEffect(() => {
    initThree()
  }, [initThree])

  useEffect(() => {
    viewRef.current = view
  }, [view])

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="lazyOnload" onLoad={() => { initTokenClient() }} />
      {!authed && (
        <div className="overlay">
          <div className="card">
            <h1>Welcome!</h1>
            <p>Sign in to load your data visualization</p>
            <button className="googleBtn" onClick={requestAccessToken} aria-label="Sign in with Google">
              <span className="googleLogo">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.06 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.64 6.053 29.082 4 24 4 12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20c0-1.341-.138-2.651-.389-3.917z"/>
                  <path fill="#FF3D00" d="M6.306 14.691l6.571 4.814C14.655 16.12 18.961 14 24 14c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.64 6.053 29.082 4 24 4 16.318 4 9.656 8.236 6.306 14.691z"/>
                  <path fill="#4CAF50" d="M24 44c5.164 0 9.86-1.977 13.409-5.197l-6.19-5.238C29.113 35.091 26.676 36 24 36c-5.219 0-9.616-3.338-11.271-7.982l-6.531 5.033C9.5 39.556 16.227 44 24 44z"/>
                  <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.58 4.467-5.777 7.692-11.303 7.692-5.219 0-9.616-3.338-11.271-7.982l-6.531 5.033C9.5 39.556 16.227 44 24 44c8.837 0 16-7.163 16-16 0-1.341-.138-2.651-.389-3.917z"/>
                </svg>
              </span>
              <span>Sign in with Google</span>
            </button>
          </div>
        </div>
      )}
      <div ref={containerRef} style={{ width: '100vw', height: '100vh', position: 'relative' }} />
      {authed && (
        <>
      <div className="menu">
            <button onClick={() => { transform(stateRef.current!.targets.table, 1200); setView('table') }}>Table</button>
            <button onClick={() => { transform(stateRef.current!.targets.sphere, 1200); setView('sphere') }}>Sphere</button>
            <button onClick={() => { transform(stateRef.current!.targets.helix, 1300); setView('helix') }}>Helix</button>
            <button onClick={() => { transform(stateRef.current!.targets.grid, 1200); setView('grid') }}>Grid</button>
      </div>
          <div className="hud">{view === 'table' ? 'Table 20×10' : view === 'sphere' ? 'Sphere' : view === 'helix' ? 'Double Helix' : 'Grid 5×4×10'}</div>
          <div className="legend">
            <div>Net Worth</div>
            <div className="bar" />
            <div className="labels"><span>Low</span><span>High</span></div>
          </div>
        </>
      )}
      {selected && (
        <div className="detail" onClick={() => setSelected(null)}>
          <div className="card" style={{ position:'relative' }} onClick={e => e.stopPropagation()}>
            <button className="close" onClick={() => setSelected(null)}>Close</button>
            <h2 style={{ margin:0 }}>{selected.name || '—'}</h2>
            <div className="row"><span>Company</span><span>{selected.company || '—'}</span></div>
            <div className="row"><span>Net Worth</span><span>{selected.networthVal ? ('$' + Number(selected.networthVal).toLocaleString()) : '—'}</span></div>
          </div>
        </div>
      )}
    </>
  )
}
