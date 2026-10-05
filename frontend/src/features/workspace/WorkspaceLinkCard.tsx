import type { WorkspaceLink } from './workspaceContracts'

export function WorkspaceLinkCard({ link }: { link: WorkspaceLink }) {
  return (
    <a className="workspace-home-card" href={link.href}>
      <span className="workspace-home-card-topline">
        <span className="workspace-home-card-symbol" aria-hidden="true">{link.symbol}</span>
        <span className="workspace-home-card-eyebrow">{link.eyebrow}</span>
      </span>
      <strong>{link.title}</strong>
      <span className="workspace-home-card-description">{link.description}</span>
      <span className="workspace-home-card-action">Abrir <span aria-hidden="true">↗</span></span>
    </a>
  )
}
