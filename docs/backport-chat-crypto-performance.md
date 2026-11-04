# Current change applicability

| Change | Existing targets | Rationale |
|---|---|---|
| Incoming chat certificate/session/message verification | 1.19.4 | Native signed-chat protocol starts in 1.19. No signature fields, authorities or chat trust UI are added to 1.18.2 or earlier. |
| Reject impossible entity collision candidates before bounding-box work | All nine supported targets | Same collision outputs/order, dead/riding exclusions and existing branch-specific boat rules. Differential and physical item/pushing checks pass. |
| Hold zoom plus wheel adjustment and menu reset | All nine supported targets | Requested extension to the optional zoom already present. Ordinary hotbar, menu and spectator wheel behavior remains when not zooming. |

No duplicate branches or new version targets were created. Tests ran in the existing named worktrees. Local worlds, configuration, shader packs, screenshots, session/capture files and authenticated account data were not staged. Distributions/Gofile files remain their earlier snapshots; their manifests were not relabeled as new builds.

See performance-mod-analysis-2026-11-04.md and performance-collision-results.json for measured scope. The project-wide todo records completed incoming verification separately from still-unsigned outgoing chat and pending report submission.
