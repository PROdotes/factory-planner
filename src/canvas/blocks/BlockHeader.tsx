/**
 * ROLE: UI Component (Block Header)
 * PURPOSE: Renders block name with inline editing, status dot, and delete button.
 * RELATION: Child of BlockCard.
 */

import { memo, useState, useRef, useEffect } from "react";
import { Trash2, CheckCircle } from "lucide-react";

interface Props {
  blockId: string;
  name: string;
  done: boolean;
  statusClass: string;
  version: number;
  wasDragged: boolean;
  onDelete: () => void;
  onNameChange: (name: string) => void;
  onToggleDone: () => void;
}

export const BlockHeader = memo(
  ({
    blockId,
    name,
    done,
    statusClass,
    version,
    wasDragged,
    onDelete,
    onNameChange,
    onToggleDone,
  }: Props) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(name);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      setEditValue(name);
    }, [name, blockId, version]);

    useEffect(() => {
      if (isEditing) inputRef.current?.focus();
    }, [isEditing]);

    return (
      <div className="block-header">
        <div className={`status-dot ${statusClass}`} />
        {isEditing ? (
          <input
            ref={inputRef}
            className="name-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => {
              setIsEditing(false);
              onNameChange(editValue);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setIsEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="block-name"
            title={name}
            onClick={(e) => {
              e.stopPropagation();
              if (!wasDragged) setIsEditing(true);
            }}
          >
            {name}
          </span>
        )}
        <button
          className={`done-btn ${done ? "active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleDone();
          }}
          title={done ? "Mark as in-progress" : "Mark as done"}
        >
          <CheckCircle size={12} />
        </button>
        <button
          className="delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>
    );
  }
);
