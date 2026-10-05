import { useRef, useState, type KeyboardEvent } from 'react'

export interface MobileNavigationItem {
  href: string
  label: string
  symbol: string
  primary?: boolean
}

interface MobileNavigationProps {
  items: MobileNavigationItem[]
  currentHash: string
}

export function MobileNavigation({ items, currentHash }: MobileNavigationProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const moreButtonRef = useRef<HTMLButtonElement>(null)
  const primaryItems = items.filter((item) => item.primary)
  const overflowItems = items.filter((item) => !item.primary)
  const currentOverflowItem = overflowItems.find((item) => item.href === currentHash)

  const closeOnEscape = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || !isExpanded) return

    event.preventDefault()
    setIsExpanded(false)
    moreButtonRef.current?.focus()
  }

  return (
    <nav className="mobile-navigation" aria-label="Navegación móvil" onKeyDown={closeOnEscape}>
      <div className="mobile-navigation-primary">
        {primaryItems.map((item) => {
          const isCurrent = item.href === currentHash

          return (
            <a
              className="mobile-navigation-item"
              href={item.href}
              aria-current={isCurrent ? 'page' : undefined}
              onClick={() => setIsExpanded(false)}
              key={item.href}
            >
              <span className="mobile-navigation-symbol" aria-hidden="true">{item.symbol}</span>
              <span>{item.label}</span>
            </a>
          )
        })}
        {overflowItems.length > 0 && (
          <button
            className={`mobile-navigation-item mobile-navigation-more${currentOverflowItem ? ' is-current' : ''}`}
            type="button"
            aria-label={currentOverflowItem
              ? `Más secciones; sección actual: ${currentOverflowItem.label}`
              : 'Más secciones'}
            aria-expanded={isExpanded}
            aria-controls="mobile-navigation-overflow"
            onClick={() => setIsExpanded((expanded) => !expanded)}
            ref={moreButtonRef}
          >
            <span className="mobile-navigation-symbol" aria-hidden="true">···</span>
            <span>Más</span>
          </button>
        )}
      </div>
      {overflowItems.length > 0 && (
        <ul
          className="mobile-navigation-overflow"
          id="mobile-navigation-overflow"
          aria-label="Más secciones"
          hidden={!isExpanded}
        >
          {overflowItems.map((item) => {
            const isCurrent = item.href === currentHash

            return (
              <li key={item.href}>
                <a
                  className="mobile-navigation-overflow-item"
                  href={item.href}
                  aria-current={isCurrent ? 'page' : undefined}
                  onClick={() => setIsExpanded(false)}
                >
                  <span className="mobile-navigation-symbol" aria-hidden="true">{item.symbol}</span>
                  <span>{item.label}</span>
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </nav>
  )
}
