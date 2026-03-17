from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.instance import LinkInstance, ObjectInstance


async def fetch_neighbors_graph(db: AsyncSession, root_id: str, depth: int = 1) -> dict:
    """Fetch neighbors/edges with layered BFS to avoid N+1 queries."""
    max_depth = max(1, min(depth, 3))

    visited: set[str] = {root_id}
    frontier: set[str] = {root_id}
    discovered_nodes: set[str] = set()
    edges_by_id: dict[str, dict] = {}

    for _ in range(max_depth):
        if not frontier:
            break

        links_result = await db.execute(
            select(LinkInstance).where(
                (LinkInstance.source_id.in_(frontier)) | (LinkInstance.target_id.in_(frontier))
            )
        )
        links = links_result.scalars().all()
        next_frontier: set[str] = set()

        for link in links:
            source_id = str(link.source_id)
            target_id = str(link.target_id)
            link_id = str(link.id)
            if link_id not in edges_by_id:
                edges_by_id[link_id] = {
                    "id": link_id,
                    "link_type_id": str(link.link_type_id),
                    "source_id": source_id,
                    "target_id": target_id,
                }

            if source_id in frontier and target_id not in visited:
                visited.add(target_id)
                next_frontier.add(target_id)
            if target_id in frontier and source_id not in visited:
                visited.add(source_id)
                next_frontier.add(source_id)

        discovered_nodes.update(next_frontier)
        frontier = next_frontier

    if not discovered_nodes:
        return {"neighbors": [], "edges": list(edges_by_id.values())}

    objects_result = await db.execute(
        select(ObjectInstance).where(ObjectInstance.id.in_(discovered_nodes))
    )
    objects = objects_result.scalars().all()
    neighbors = [
        {
            "id": str(obj.id),
            "object_type_id": str(obj.object_type_id),
            "display_name": obj.display_name,
            "properties": obj.properties,
            "source_pipeline_id": obj.source_pipeline_id,
            "source_run_id": obj.source_run_id,
            "source_row_index": obj.source_row_index,
            "created_at": obj.created_at.isoformat() if obj.created_at else None,
            "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
        }
        for obj in objects
    ]
    return {"neighbors": neighbors, "edges": list(edges_by_id.values())}
