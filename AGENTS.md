<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Gallery grids use Storage-rendered 360px image previews while fullscreen viewing keeps original signed media URLs, reducing transfer time without degrading originals.
- Nossa Casa is a React Three Fiber isometric scene using bundled CC0 Kenney GLBs in public/house; hearts are awarded only by server-checked duo missions (home_presence heartbeat) so nobody earns alone.
- 3D people share the serializable Look model (src/lib/look.ts, sanitized server-side); Nossa Casa uses the lightweight blocky HouseDoll matching its original tiny-character style, while Desfile uses the detailed articulated Doll.
- Nossa Casa renders without realtime shadow maps (static contact shadows + blob shadows); why: shadow passes were the main mobile frame-rate cost.
- Turn-based 3D games (futebol, desfile) sync only inputs/results and simulate deterministically on both devices; one side is authority for writes; why: avoids per-frame network traffic.
- Chat alerts for bb gu use payloadless Web Push (public/push-sw.js, VAPID key derived from SESSION_SECRET, subscriptions in push_subs) plus in-page polling; why: mobile browsers suspend background tabs, and the push carries no message content.
