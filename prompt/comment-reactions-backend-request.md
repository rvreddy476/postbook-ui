# Copy-paste request for Claude — comment and reply reactions

Workspace: C:/workspace/modernsmapp (SOCIAL backend only). Do not touch Commerce, Mopedu or C:/workspace/postbook-ui. Preserve the existing dirty tree; no stage/commit/branch/push without a separate request.

The web now has a reusable six-choice ReactionControl (like, love, smile, wow, sad, angry). Group posts already use the deployed PUT/DELETE reaction contract. Main-feed posts use POST /v1/posts/:id/react, mapping the display choice Smile to the existing wire value haha. Ordinary comments and replies currently expose only like/dislike; group comments and replies have no reaction write route. Do not claim a working six-choice comment picker until persistence and reads exist.

Implement the missing COMMENT/REPLY API support, after inspecting the current stores and access checks. Keep legacy likes/dislikes compatible; do not introduce a second independent count source. Propose and document any unavoidable migration/product decision before destructive changes.

Requested web-facing contract (confirm exact route spelling in the handover):

- PUT /v1/comments/:commentId/reaction {"reaction":"like"|"love"|"smile"|"wow"|"sad"|"angry"}
- DELETE /v1/comments/:commentId/reaction
- PUT /v1/groups/:groupId/posts/v2/:postId/comments/:commentId/reaction with the same body
- DELETE /v1/groups/:groupId/posts/v2/:postId/comments/:commentId/reaction
- Use the same route for a reply's own comment ID. Validate group -> post -> comment ownership; a comment or reply cannot be addressed through another group/post.
- Return 200 {data:{comment_id,reaction:string|null,reaction_count:number,reaction_counts:{...},viewer_reacted:boolean}} with authoritative read-back state. Add viewer_reaction, reaction_count and reaction_counts to every comment/reply read surface, including nested replies and realtime updates. Empty counts must be {}, not null.

Acceptance:

1. One current reaction per viewer/comment. Replacement is atomic; concurrent first writes cannot duplicate rows/counts. Repeating a PUT of the same value and DELETE of an absent value are no-op 200 responses.
2. Six-value allowlist; invalid value is 422 before mutation. Do not blindly reuse post-service's haha spelling: accept the web's smile spelling or explicitly document normalization.
3. Enforce parent-post visibility, no-engagement settings where applicable, blocked/banned membership and deleted/unpublished parents. Keep private-group refusal generic, as for group-post reactions. A reply must inherit its parent's access boundaries.
4. Viewer selection survives reload. Existing ordinary-comment like/dislike behavior must not leave contradictory Like and emoji rows or lose existing counts; state clearly how dislike interacts with a positive emoji reaction.
5. Use the same current-viewer fields for Feed, Reels, Tube comments where those surfaces share the same underlying comment IDs; enumerate any genuinely separate comment system rather than claiming it is covered.
6. Tests through real HTTP handlers plus disposable-database proofs: all six values, replacement, repeat PUT/DELETE, concurrent first writes, permission refusals with unchanged rows, wrong parent IDs, reload, existing legacy likes/dislikes, and nested replies.
7. Provide captured request/response bodies, exact error codes, migrations, gates, and deployment status in docs/handoffs. No fixtures in the deployed image.

Do not modify the web. Send the exact supported contract back so the shared control can be wired without pretending unsupported reactions were saved.
