import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { recordAuditLog } from "../utils/audit.util";
import { toApiError } from "../utils/prismaErrors";
import { CampusInput, DepartmentInput } from "../validators/academic.validator";

// --- Campuses ---

/** GET /api/campuses — any authenticated user (reference data for dropdowns/filters). */
export async function listCampuses(_req: Request, res: Response, next: NextFunction) {
  try {
    const campuses = await prisma.campus.findMany({ orderBy: { name: "asc" } });
    return res.status(200).json({ campuses });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/campuses — Super Admin only. */
export async function createCampus(req: Request, res: Response, next: NextFunction) {
  try {
    const campus = await prisma.campus.create({ data: req.body as CampusInput });
    await recordAuditLog({ userId: req.user!.sub, action: "CAMPUS_CREATED", entityType: "Campus", entityId: campus.id, req });
    return res.status(201).json(campus);
  } catch (err) {
    return next(toApiError(err, { entity: "campus" }));
  }
}

/** PATCH /api/campuses/:id — Super Admin only. */
export async function updateCampus(req: Request, res: Response, next: NextFunction) {
  try {
    const campus = await prisma.campus.update({
      where: { id: req.params.id },
      data: req.body as Partial<CampusInput>,
    });
    await recordAuditLog({ userId: req.user!.sub, action: "CAMPUS_UPDATED", entityType: "Campus", entityId: campus.id, req });
    return res.status(200).json(campus);
  } catch (err) {
    return next(toApiError(err, { entity: "campus" }));
  }
}

/** DELETE /api/campuses/:id — Super Admin only. Blocked if students/classes still reference it. */
export async function deleteCampus(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.campus.delete({ where: { id: req.params.id } });
    await recordAuditLog({ userId: req.user!.sub, action: "CAMPUS_DELETED", entityType: "Campus", entityId: req.params.id, req });
    return res.status(204).send();
  } catch (err) {
    return next(toApiError(err, { entity: "campus" }));
  }
}

// --- Departments ---

/** GET /api/departments — any authenticated user. */
export async function listDepartments(_req: Request, res: Response, next: NextFunction) {
  try {
    const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
    return res.status(200).json({ departments });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/departments — Super Admin only. */
export async function createDepartment(req: Request, res: Response, next: NextFunction) {
  try {
    const department = await prisma.department.create({ data: req.body as DepartmentInput });
    await recordAuditLog({
      userId: req.user!.sub,
      action: "DEPARTMENT_CREATED",
      entityType: "Department",
      entityId: department.id,
      req,
    });
    return res.status(201).json(department);
  } catch (err) {
    return next(toApiError(err, { entity: "department" }));
  }
}

/** PATCH /api/departments/:id — Super Admin only. */
export async function updateDepartment(req: Request, res: Response, next: NextFunction) {
  try {
    const department = await prisma.department.update({
      where: { id: req.params.id },
      data: req.body as Partial<DepartmentInput>,
    });
    await recordAuditLog({
      userId: req.user!.sub,
      action: "DEPARTMENT_UPDATED",
      entityType: "Department",
      entityId: department.id,
      req,
    });
    return res.status(200).json(department);
  } catch (err) {
    return next(toApiError(err, { entity: "department" }));
  }
}

/** DELETE /api/departments/:id — Super Admin only. */
export async function deleteDepartment(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.department.delete({ where: { id: req.params.id } });
    await recordAuditLog({
      userId: req.user!.sub,
      action: "DEPARTMENT_DELETED",
      entityType: "Department",
      entityId: req.params.id,
      req,
    });
    return res.status(204).send();
  } catch (err) {
    return next(toApiError(err, { entity: "department" }));
  }
}
