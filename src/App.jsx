import { useState, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import * as XLSX from 'xlsx'
import './App.css'

function SortableSlot({ id, paddler, index, side, onRemove }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`slot ${paddler ? 'filled' : ''} ${isDragging ? 'dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      <span className="seat-num">{index + 1}</span>
      {paddler ? (
        <div className="paddler-info">
          <span className="name">{paddler.name}</span>
          <span className="details">{paddler.weight}kg, {paddler.experience}yr</span>
          <button
            className="remove"
            onClick={(e) => {
              e.stopPropagation()
              onRemove(paddler.id)
            }}
          >
            ×
          </button>
        </div>
      ) : (
        <span className="empty">Empty</span>
      )}
    </div>
  )
}

function App() {
  const [paddlers, setPaddlers] = useState([])
  const [leftSlots, setLeftSlots] = useState(Array(20).fill(null))
  const [rightSlots, setRightSlots] = useState(Array(20).fill(null))
  const [form, setForm] = useState({
    name: '',
    weight: 60,
    experience: 3,
    side: 'right',
  })
  const fileInputRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleImport = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const json = XLSX.utils.sheet_to_json(sheet)

      // Expected columns: Name, Weight, Experience, Side
      const newPaddlers = json.map((row, idx) => ({
        name: row.Name || row.name || row.姓名 || '',
        weight: Number(row.Weight || row.weight || row.体重 || 60),
        experience: Number(row.Experience || row.experience || row.经验 || 3),
        side: (row.Side || row.side || row.侧 || 'any').toString().toLowerCase(),
        id: Date.now() + idx,
      })).filter(p => p.name)

      // Add paddlers to slots
      let leftIdx = 0
      let rightIdx = 0
      const newLeftSlots = [...leftSlots]
      const newRightSlots = [...rightSlots]

      newPaddlers.forEach(p => {
        if (p.side === 'left' && leftIdx < 10) {
          newLeftSlots[leftIdx++] = p
        } else if (p.side === 'right' && rightIdx < 10) {
          newRightSlots[rightIdx++] = p
        } else {
          // Put on lighter side
          const leftWeight = newLeftSlots.reduce((s, p) => s + (p?.weight || 0), 0)
          const rightWeight = newRightSlots.reduce((s, p) => s + (p?.weight || 0), 0)
          if (leftWeight <= rightWeight && leftIdx < 10) {
            newLeftSlots[leftIdx++] = p
          } else if (rightIdx < 10) {
            newRightSlots[rightIdx++] = p
          }
        }
      })

      setLeftSlots(newLeftSlots)
      setRightSlots(newRightSlots)
      setPaddlers([...paddlers, ...newPaddlers])
    }
    reader.readAsArrayBuffer(file)
    event.target.value = ''
  }

  const addPaddler = () => {
    if (!form.name.trim()) return
    const newPaddler = { ...form, id: Date.now() }
    
    // Find first empty slot on the preferred side
    if (form.side === 'left') {
      const emptyIdx = leftSlots.findIndex(s => s === null)
      if (emptyIdx !== -1) {
        const newSlots = [...leftSlots]
        newSlots[emptyIdx] = newPaddler
        setLeftSlots(newSlots)
      }
    } else if (form.side === 'right') {
      const emptyIdx = rightSlots.findIndex(s => s === null)
      if (emptyIdx !== -1) {
        const newSlots = [...rightSlots]
        newSlots[emptyIdx] = newPaddler
        setRightSlots(newSlots)
      }
    } else {
      // "any" - put on lighter side
      const leftWeight = leftSlots.reduce((s, p) => s + (p?.weight || 0), 0)
      const rightWeight = rightSlots.reduce((s, p) => s + (p?.weight || 0), 0)
      
      if (leftWeight <= rightWeight) {
        const emptyIdx = leftSlots.findIndex(s => s === null)
        if (emptyIdx !== -1) {
          const newSlots = [...leftSlots]
          newSlots[emptyIdx] = newPaddler
          setLeftSlots(newSlots)
        }
      } else {
        const emptyIdx = rightSlots.findIndex(s => s === null)
        if (emptyIdx !== -1) {
          const newSlots = [...rightSlots]
          newSlots[emptyIdx] = newPaddler
          setRightSlots(newSlots)
        }
      }
    }

    setPaddlers([...paddlers, newPaddler])
    setForm({ name: '', weight: 60, experience: 3, side: 'right' })
  }

  const removePaddler = (id) => {
    setLeftSlots(leftSlots.map(p => p?.id === id ? null : p))
    setRightSlots(rightSlots.map(p => p?.id === id ? null : p))
    setPaddlers(paddlers.filter(p => p.id !== id))
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    
    if (!over) return

    const activeId = active.id
    const overId = over.id

    // Parse the id format: "left-0" or "right-0"
    const [activeSide, activeIndex] = activeId.split('-')
    const [overSide, overIndex] = overId.split('-')

    if (activeSide === overSide) {
      // Same side - reorder
      const sideSlots = activeSide === 'left' ? [...leftSlots] : [...rightSlots]
      const fromIndex = parseInt(activeIndex)
      const toIndex = parseInt(overIndex)
      
      const newSlots = arrayMove(sideSlots, fromIndex, toIndex)
      
      if (activeSide === 'left') {
        setLeftSlots(newSlots)
      } else {
        setRightSlots(newSlots)
      }
    } else {
      // Different side - move paddler
      const fromSlots = activeSide === 'left' ? [...leftSlots] : [...rightSlots]
      const toSlots = overSide === 'left' ? [...leftSlots] : [...rightSlots]
      
      const fromIndex = parseInt(activeIndex)
      const toIndex = parseInt(overIndex)
      
      const paddler = fromSlots[fromIndex]
      fromSlots[fromIndex] = null
      toSlots[toIndex] = paddler

      if (activeSide === 'left') {
        setLeftSlots(fromSlots)
        setRightSlots(toSlots)
      } else {
        setRightSlots(fromSlots)
        setLeftSlots(toSlots)
      }
    }
  }

  const getAllSlots = () => {
    return [
      ...leftSlots.map((p, i) => ({ id: `left-${i}`, paddler: p, side: 'left', index: i })),
      ...rightSlots.map((p, i) => ({ id: `right-${i}`, paddler: p, side: 'right', index: i })),
    ]
  }

  const totalWeight = paddlers.reduce((sum, p) => sum + p.weight, 0)
  const avgWeight = paddlers.length ? Math.round(totalWeight / paddlers.length) : 0
  const leftWeight = leftSlots.reduce((s, p) => s + (p?.weight || 0), 0)
  const rightWeight = rightSlots.reduce((s, p) => s + (p?.weight || 0), 0)

  return (
    <div className="app">
      <header>
        <h1>🚤 Dragon Boat Lineup</h1>
      </header>

      <section className="instructions">
        <h2>📖 How to Use</h2>
        <ol>
          <li><strong>Add paddlers</strong> manually using the form, or import from an Excel file</li>
          <li><strong>Drag & drop</strong> paddlers to reorder or move between left/right sides</li>
          <li><strong>Balance the boat</strong> by checking the weight totals on each side</li>
          <li><strong>Remove</strong> paddlers by clicking the × button</li>
        </ol>
      </section>

      <main>
        <section className="input-section">
          <h2>Add Paddler</h2>
          <div className="form-row">
            <label>
              Name
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Weight (kg)
              <input
                type="number"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
              />
            </label>
            <label>
              Experience (years)
              <input
                type="number"
                value={form.experience}
                onChange={(e) => setForm({ ...form, experience: Number(e.target.value) })}
              />
            </label>
            <label>
              Side
              <select
                value={form.side}
                onChange={(e) => setForm({ ...form, side: e.target.value })}
              >
                <option value="right">Right</option>
                <option value="left">Left</option>
                <option value="any">Any</option>
              </select>
            </label>
            <button onClick={addPaddler}>Add</button>
            <button onClick={() => fileInputRef.current?.click()} className="import-btn">
              Import Excel
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </div>
          <div className="import-help">
            <details>
              <summary>📋 Expected Excel Columns</summary>
              <ul>
                <li><strong>Name</strong> (or 姓名) - Paddler name</li>
                <li><strong>Weight</strong> (or 体重) - Weight in kg</li>
                <li><strong>Experience</strong> (or 经验) - Years of experience</li>
                <li><strong>Side</strong> (or 侧) - left / right / any</li>
              </ul>
            </details>
          </div>
        </section>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <section className="boat-section">
            <h2>
              Boat ({paddlers.length}/10 paddlers)
              {paddlers.length > 0 && (
                <span className="stats">
                  | Avg: {avgWeight}kg
                </span>
              )}
            </h2>
            
            <div className="boat">
              <div className="positions">
                <div className="position-row">
                  <div className="position">
                    <span className="label">🥁 Drummer</span>
                    <span className="slot">-</span>
                  </div>
                  <div className="position">
                    <span className="label">🎣 Steer</span>
                    <span className="slot">-</span>
                  </div>
                </div>
              </div>

              <div className="paddler-slots">
                <div className="side left">
                  <h3>Left</h3>
                  <SortableContext
                    items={leftSlots.map((_, i) => `left-${i}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {leftSlots.map((p, i) => (
                      <SortableSlot
                        key={`left-${i}`}
                        id={`left-${i}`}
                        paddler={p}
                        index={i}
                        side="left"
                        onRemove={removePaddler}
                      />
                    ))}
                  </SortableContext>
                  <div className="side-total">
                    Total: {leftWeight}kg
                  </div>
                </div>
                
                <div className="side right">
                  <h3>Right</h3>
                  <SortableContext
                    items={rightSlots.map((_, i) => `right-${i}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {rightSlots.map((p, i) => (
                      <SortableSlot
                        key={`right-${i}`}
                        id={`right-${i}`}
                        paddler={p}
                        index={i}
                        side="right"
                        onRemove={removePaddler}
                      />
                    ))}
                  </SortableContext>
                  <div className="side-total">
                    Total: {rightWeight}kg
                  </div>
                </div>
              </div>
            </div>
          </section>
        </DndContext>

        <section className="paddlers-section">
          <h2>All Paddlers ({paddlers.length})</h2>
          <div className="paddler-list">
            {paddlers.map((p) => (
              <div key={p.id} className="paddler-card">
                <span className="paddler-name">{p.name}</span>
                <span>{p.weight}kg</span>
                <span>{p.experience}yr</span>
                <span className={`side ${p.side}`}>{p.side}</span>
                <button className="remove" onClick={() => removePaddler(p.id)}>×</button>
              </div>
            ))}
            {paddlers.length === 0 && <p className="empty-msg">No paddlers yet. Add some above!</p>}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
