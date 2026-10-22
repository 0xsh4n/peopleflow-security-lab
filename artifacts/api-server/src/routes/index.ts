import { Router, type IRouter } from "express";
import healthRouter from "./health";
import peopleFlowRouter from "./peopleflow";

const router: IRouter = Router();

router.use(healthRouter);
router.use(peopleFlowRouter);

export default router;
