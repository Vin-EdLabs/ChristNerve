import { ROOM_TYPE_OPTIONS } from '../../utils/liveRooms';
import type { LiveRoomType } from '../../types/live';

export interface RoomTypePickerProps {
  value: LiveRoomType;
  onChange: (value: LiveRoomType) => void;
}

export function RoomTypePicker({ value, onChange }: RoomTypePickerProps) {
  return (
    <div className="form-group">
      <label className="label">Room Type</label>
      <div className="room-type-picker" role="radiogroup" aria-label="Room type">
        {ROOM_TYPE_OPTIONS.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`room-type-chip${selected ? ' is-selected' : ''}`}
              onClick={() => onChange(opt.value)}
              style={selected ? { borderColor: opt.color, background: `${opt.color}14` } : undefined}
            >
              <span className="room-type-chip-icon" style={{ background: `${opt.color}1f`, color: opt.color }}>
                <opt.icon size={18} strokeWidth={2} />
              </span>
              <span className="room-type-chip-label">{opt.label}</span>
            </button>
          );
        })}
      </div>

      <style>{`
        .room-type-picker {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 8px;
        }
        .room-type-chip {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 12px;
          border: 1.5px solid var(--border);
          background: var(--bg-surface, #fff);
          cursor: pointer; text-align: left;
          transition: border-color .15s ease, background-color .15s ease, transform .1s ease;
        }
        .room-type-chip:hover { transform: translateY(-1px); }
        .room-type-chip.is-selected { font-weight: 600; }
        .room-type-chip-icon {
          width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
          display: grid; place-items: center;
        }
        .room-type-chip-label { font-size: .86rem; }
        @media (max-width: 480px) {
          .room-type-picker { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}

export default RoomTypePicker;
