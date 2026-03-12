import { useState, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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

function SortableSlot({ id, paddler, index, onRemove, showWeight }) {
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

  const genderColor = paddler?.gender?.toUpperCase() === 'F' ? '#ff5252' : paddler?.gender?.toUpperCase() === 'M' ? '#4488ff' : null

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: genderColor,
        borderColor: genderColor,
      }}
      className={`slot ${paddler ? 'filled' : ''} ${isDragging ? 'dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      <span className="seat-num">{index + 1}</span>
      {paddler ? (
        <div className="paddler-info">
          <span className="name">{paddler.name}</span>
          <span className="details">{showWeight ? paddler.weight + 'kg' : ''}</span>
          <span className={`side-badge ${paddler.side}`}>{paddler.side}</span>
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

function SortablePaddler({ id, paddler, onRemove }) {
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
      className={`paddler-item ${isDragging ? 'dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      <span className="name">{paddler.name}</span>
      <span className="details">{paddler.weight}kg{paddler.gender?.toLowerCase() !== 'any' ? ', ' + paddler.gender : ''}</span>
      <span className={`side-badge ${paddler.side}`}>{paddler.side}</span>
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
  )
}

function App() {
  const [paddlerList, setPaddlerList] = useState([])
  const [leftSlots, setLeftSlots] = useState(Array(10).fill(null))
  const [rightSlots, setRightSlots] = useState(Array(10).fill(null))
  const [drummer, setDrummer] = useState('')
  const [steer, setSteer] = useState('')
  const [showWeight, setShowWeight] = useState(true)
  const [form, setForm] = useState({
    name: '',
    weight: 60,
    gender: 'any',
    side: 'any',
  })
  const fileInputRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
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

      if (json.length === 0) {
        alert('Excel sheet is empty!')
        event.target.value = ''
        return
      }

      // Check if required columns exist
      const firstRow = json[0]
      const hasNameColumn = firstRow.Name || firstRow.name || firstRow.姓名
      const hasWeightColumn = firstRow.Weight || firstRow.weight || firstRow.体重
      const hasGenderColumn = firstRow.Gender || firstRow.gender || firstRow.性别
      const hasSideColumn = firstRow.Side || firstRow.side || firstRow.侧

      const missingColumns = []
      if (!hasNameColumn) missingColumns.push('Name (or 姓名)')
      if (!hasWeightColumn) missingColumns.push('Weight (or 体重)')
      if (!hasGenderColumn) missingColumns.push('Gender (or 性别)')
      if (!hasSideColumn) missingColumns.push('Side (or 侧)')

      if (missingColumns.length > 0) {
        alert(`Missing required columns: ${missingColumns.join(', ')}\n\nExpected columns:\n- Name (or 姓名)\n- Weight (or 体重)\n- Gender (or 性别)\n- Side (or 侧)`)
        event.target.value = ''
        return
      }

      let newPaddlers = json.map((row, idx) => ({
        name: row.Name || row.name || row.姓名 || '',
        weight: Number(row.Weight || row.weight || row.体重 || 60),
        gender: (row.Gender || row.gender || row.性别 || 'any').toString().toLowerCase(),
        side: (row.Side || row.side || row.侧 || 'any').toString().toLowerCase(),
        id: Date.now() + idx,
      })).filter(p => p.name)

      // Check if total exceeds 20
      const totalAfterImport = paddlerList.length + newPaddlers.length
      if (totalAfterImport > 20) {
        alert(`Maximum 20 paddlers allowed! You have ${totalAfterImport} paddlers. Only first ${20 - paddlerList.length} will be added.`)
        newPaddlers = newPaddlers.slice(0, 20 - paddlerList.length)
      }

      setPaddlerList([...paddlerList, ...newPaddlers])
    }
    reader.readAsArrayBuffer(file)
    event.target.value = ''
  }

  const addPaddler = () => {
    if (!form.name.trim()) return
    
    if (paddlerList.length >= 20) {
      alert('Maximum 20 paddlers allowed!')
      return
    }
    
    const newPaddler = { ...form, id: Date.now() }
    
    // Add new paddler and sort by weight (for any-side paddlers)
    const newList = [...paddlerList, newPaddler].sort((a, b) => {
      // Prefer paddlers with specific side preference
      if (a.side !== 'any' && b.side === 'any') return -1
      if (a.side === 'any' && b.side !== 'any') return 1
      // Then sort by weight
      return a.weight - b.weight
    })
    
    setPaddlerList(newList)
    setForm({ name: '', weight: 60, gender: 'any', side: 'any' })
  }

  const removePaddler = (id) => {
    setPaddlerList(paddlerList.filter(p => p.id !== id))
  }

  const generateLineup = () => {
    if (paddlerList.length > 20) {
      alert('Maximum 20 paddlers allowed!')
      return
    }
    
    // Separate paddlers by side preference
    const leftPreferred = paddlerList.filter(p => p.side === 'left')
    const rightPreferred = paddlerList.filter(p => p.side === 'right')
    const anySide = paddlerList.filter(p => p.side !== 'left' && p.side !== 'right')
    
    const newLeft = Array(10).fill(null)
    const newRight = Array(10).fill(null)
    
    // Helper to place paddlers by positionWeights (heavier in middle)
    const placeByPosition = (paddlers, sideArray) => {
      if (paddlers.length === 0) return
      
      const sorted = [...paddlers].sort((a, b) => b.weight - a.weight)
      const startIdx = 4
      for (let i = 0; i < sorted.length; i++) {
        const posIdx = startIdx + (i % 2 === 0 ? -Math.ceil(i / 2) : Math.ceil(i / 2))
        if (posIdx >= 0 && posIdx < sideArray.length) {
          sideArray[posIdx] = sorted[i]
        } else {
          // If we run out of positions (shouldn't happen with max 10), just fill remaining
          sideArray.push(sorted[i])
        }
      }
    }
    
    // Fill remaining with any-side paddlers, balancing by weight
    const remainingAny = [...anySide]
    let leftFilled = leftPreferred.length;
    let rightFilled = rightPreferred.length;
    
    remainingAny.forEach(p => {
      const leftWeight = newLeft.reduce((s, p) => s + (p?.weight || 0), 0)
      const rightWeight = newRight.reduce((s, p) => s + (p?.weight || 0), 0)
      
      if (leftWeight <= rightWeight && leftFilled < 10) {
        // newLeft[leftFilled++] = p
        leftPreferred.push(p);
        leftFilled++;
      } else {
        // newRight[rightFilled++] = p
        rightPreferred.push(p);
        rightFilled++;
      }
    })

    // Place left-preferred on left side (heavier in middle)
    placeByPosition(leftPreferred, newLeft)
    
    // Place right-preferred on right side (heavier in middle)
    placeByPosition(rightPreferred, newRight)

    setLeftSlots(newLeft)
    setRightSlots(newRight)
  }

  const clearList = () => {
    setPaddlerList([])
  }

  const clearBoat = () => {
    setLeftSlots(Array(10).fill(null))
    setRightSlots(Array(10).fill(null))
  }

  const removeFromBoat = (id) => {
    setLeftSlots(leftSlots.map(p => p?.id === id ? null : p))
    setRightSlots(rightSlots.map(p => p?.id === id ? null : p))
    setPaddlerList(paddlerList.filter(p => p.id !== id))
  }

  const handleListDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setPaddlerList(arrayMove(paddlerList, active.index, over.index))
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    
    if (!over) return

    const activeId = active.id
    const overId = over.id
    const [activeSide, activeIndex] = activeId.split('-')
    const [overSide, overIndex] = overId.split('-')

    if (activeSide === overSide) {
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
      const fromSlots = activeSide === 'left' ? [...leftSlots] : [...rightSlots]
      const toSlots = activeSide === 'left' ? [...rightSlots] : [...leftSlots]
      
      const fromIndex = parseInt(activeIndex)
      const toIndex = parseInt(overIndex)
      
      const paddler = fromSlots[fromIndex]
      const targetPaddler = toSlots[toIndex]
      
      fromSlots[fromIndex] = targetPaddler
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

  const calculateRowGroupWeights = (slots) => {
    const rows1to3 = slots.slice(0, 3).reduce((s, p) => s + (p?.weight || 0), 0)
    const rows4to7 = slots.slice(3, 7).reduce((s, p) => s + (p?.weight || 0), 0)
    const rows8to10 = slots.slice(7, 10).reduce((s, p) => s + (p?.weight || 0), 0)
    return { rows1to3, rows4to7, rows8to10 }
  }

  const totalWeight = [...leftSlots, ...rightSlots].reduce((sum, p) => sum + (p?.weight || 0), 0)
  const avgWeight = [...leftSlots, ...rightSlots].filter(p => p).length ? Math.round(totalWeight / [...leftSlots, ...rightSlots].filter(p => p).length) : 0
  const leftWeight = leftSlots.reduce((s, p) => s + (p?.weight || 0), 0)
  const rightWeight = rightSlots.reduce((s, p) => s + (p?.weight || 0), 0)
  const leftFront3 = leftSlots.slice(0, 3).reduce((s, p) => s + (p?.weight || 0), 0)
  const rightFront3 = rightSlots.slice(0, 3).reduce((s, p) => s + (p?.weight || 0), 0)
  const filledSlots = [...leftSlots, ...rightSlots].filter(p => p).length
  const leftRowGroups = calculateRowGroupWeights(leftSlots)
  const rightRowGroups = calculateRowGroupWeights(rightSlots)

  return (
    <div className="app">
      <header>
        <h1>🚤 Dragon Boat Lineup1</h1>
      </header>

      <section className="instructions">
        <h2>📖 How to Use</h2>
        <ol>
          <li><strong>Add paddlers</strong> to the list below (manually or via Excel)</li>
          <li>Click <strong>Generate Lineup</strong> to auto-assign to boat</li>
          <li><strong>Drag & drop</strong> paddlers to reorder or move between sides</li>
          <li><strong>Balance</strong> by checking weight totals on each side</li>
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
              Gender
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option value="any">Any</option>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </label>
            <label>
              Side
              <select
                value={form.side}
                onChange={(e) => setForm({ ...form, side: e.target.value })}
              >
                <option value="any">Any</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
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
                <li><strong>Name</strong> (or 姓名)</li>
                <li><strong>Weight</strong> (or 体重)</li>
                <li><strong>Gender</strong> - M / F / any</li>
                <li><strong>Side</strong> (or 侧) - left / right / any</li>
              </ul>
            </details>
          </div>
        </section>

        <section className="list-section">
          <h2>Paddler List ({paddlerList.length})</h2>
          
          {paddlerList.length > 0 ? (
            <SortableContext
              items={paddlerList.map(p => p.id)}
              strategy={verticalListSortingStrategy}
              onDragEnd={handleListDragEnd}
            >
              <div className="paddler-list">
                {paddlerList.map((p) => (
                  <SortablePaddler
                    key={p.id}
                    id={p.id}
                    paddler={p}
                    onRemove={removePaddler}
                  />
                ))}
              </div>
            </SortableContext>
          ) : (
            <p className="empty-msg">No paddlers yet. Add some above!</p>
          )}
          
          <div className="list-actions">
            <button onClick={generateLineup} className="generate-btn" disabled={paddlerList.length === 0}>
              Generate Lineup
            </button>
            <button onClick={clearBoat} className="clear-btn">
              Clear Boat
            </button>
            <button onClick={clearList} className="clear-btn" disabled={paddlerList.length === 0}>
              Clear List
            </button>
          </div>
        </section>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <section className="boat-section">
            <h2>
              Boat ({filledSlots}/20)
              {filledSlots > 0 && (
                <span className="stats">
                  | Avg: {avgWeight}kg
                </span>
              )}
            </h2>
            <button onClick={() => setShowWeight(!showWeight)} className="toggle-weight">
              {showWeight ? 'Hide Weight' : 'Show Weight'}
            </button>
            
            <div className="boat">
              <div className="positions">
                <div className="position-row">
                  <div className="position">
                    <span className="label">🥁 Drummer</span>
                    <input
                      type="text"
                      className="position-input"
                      placeholder="Name"
                      value={drummer}
                      onChange={(e) => setDrummer(e.target.value)}
                    />
                  </div>
                  <div className="position">
                    <span className="label">🎣 Steer</span>
                    <input
                      type="text"
                      className="position-input"
                      placeholder="Name"
                      value={steer}
                      onChange={(e) => setSteer(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="paddler-slots">
                
                <SortableContext
                  items={leftSlots.map((_, i) => `left-${i}`)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="side left">
                    <div className="row-groups left">
                      <div className="row-group">Row 1-3<br></br>{leftRowGroups.rows1to3}kg</div>
                      <div className="row-group">Row 4-7<br></br>{leftRowGroups.rows4to7}kg</div>
                      <div className="row-group">Row 8-10<br></br>{leftRowGroups.rows8to10}kg</div>
                    </div>
                    <h3>Left</h3>
                    {leftSlots.map((p, i) => (
                      <SortableSlot
                        key={`left-${i}`}
                        id={`left-${i}`}
                        paddler={p}
                        index={i}
                        onRemove={removeFromBoat}
                        showWeight={showWeight}
                      />
                    ))}
                    <div className="side-total">
                      Total: {leftWeight}kg
                    </div>
                  </div>
                </SortableContext>
                
                <SortableContext
                  items={rightSlots.map((_, i) => `right-${i}`)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="side right">
                    <div className="row-groups right">
                      <div className="row-group">Row 1-3<br></br>{rightRowGroups.rows1to3}kg</div>
                      <div className="row-group">Row 4-7<br></br>{rightRowGroups.rows4to7}kg</div>
                      <div className="row-group">Row 8-10<br></br>{rightRowGroups.rows8to10}kg</div>
                    </div>
                    <h3>Right</h3>
                    {rightSlots.map((p, i) => (
                      <SortableSlot
                        key={`right-${i}`}
                        id={`right-${i}`}
                        paddler={p}
                        index={i}
                        onRemove={removeFromBoat}
                        showWeight={showWeight}
                      />
                    ))}
                    <div className="side-total">
                      Total: {rightWeight}kg
                    </div>
                  </div>
                </SortableContext>
              </div>
            </div>
          </section>
        </DndContext>
      </main>
    </div>
  )
}

export default App
