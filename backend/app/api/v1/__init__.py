from fastapi import APIRouter

from app.api.v1 import auth, ontology, instances, data_sources, pipelines, aip, alerts

router = APIRouter(prefix="/api/v1")
router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
router.include_router(ontology.router, prefix="/ontology", tags=["Ontology"])
router.include_router(instances.router, prefix="/instances", tags=["Instances"])
router.include_router(data_sources.router, prefix="/data-sources", tags=["Data Sources"])
router.include_router(pipelines.router, prefix="/pipelines", tags=["Pipelines"])
router.include_router(aip.router, prefix="/aip", tags=["AI Platform"])
router.include_router(alerts.router, prefix="/alerts", tags=["Alerts"])
