import { useEffect, useRef, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { Check, Link2, X } from 'lucide-react'
import { cn } from 'cn'

import { Button } from '@/shared/components/ui/button'

interface LinkControlProps {
  readonly onLink: (url: string) => boolean
}

interface LinkFormProps {
  readonly onLink: (url: string) => boolean
  readonly onClose: () => void
}

interface LinkFieldProps {
  readonly value: string
  readonly invalid: boolean
  readonly onChange: (value: string) => void
  readonly onClose: () => void
}

function LinkField({ value, invalid, onChange, onClose }: Readonly<LinkFieldProps>) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <input
      ref={inputRef}
      value={value}
      aria-label="链接地址"
      aria-invalid={invalid}
      placeholder="https://…"
      spellCheck={false}
      className={cn(
        'h-6 w-40 rounded-md border px-2 text-xs text-slate-700 outline-none',
        invalid
          ? 'border-red-300 bg-red-50 focus:border-red-400'
          : 'border-slate-200 bg-white focus:border-primary',
      )}
      onChange={(event) => {
        onChange(event.target.value)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }}
    />
  )
}

function LinkForm({ onLink, onClose }: Readonly<LinkFormProps>) {
  const [url, setUrl] = useState('')
  const [invalid, setInvalid] = useState(false)

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (onLink(url)) {
      onClose()
      return
    }
    setInvalid(true)
  }

  function handleChange(value: string): void {
    setUrl(value)
    setInvalid(false)
  }

  return (
    <form className="flex items-center gap-0.5" onSubmit={handleSubmit}>
      <LinkField value={url} invalid={invalid} onChange={handleChange} onClose={onClose} />
      <Button type="submit" variant="ghost" size="icon-xs" aria-label="应用链接" title="应用链接">
        <Check aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="取消链接"
        title="取消"
        onClick={onClose}
      >
        <X aria-hidden="true" />
      </Button>
    </form>
  )
}

export function LinkControl({ onLink }: Readonly<LinkControlProps>) {
  const [open, setOpen] = useState(false)

  if (open) {
    return (
      <LinkForm
        onLink={onLink}
        onClose={() => {
          setOpen(false)
        }}
      />
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label="插入链接"
      title="插入链接"
      onMouseDown={(event) => {
        event.preventDefault()
      }}
      onClick={() => {
        setOpen(true)
      }}
    >
      <Link2 aria-hidden="true" />
    </Button>
  )
}
