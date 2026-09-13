import { NextFunction, Request, Response } from "express";
import { RoleName } from "@prisma/client";
import { ApiError } from "../utils/apiError";

/**
 * Restricts a route to one or more roles. Must run after `authenticate`.
 *
 * Usage: router.post("/results/publish", authenticate, authorize("ACADEMIC_ADMIN"), handler)
 *
 * This covers coarse role checks. Fine-grained permissions (e.g. a specific
 * Academic Admin who is allowed to publish results for only one campus) are
 * layered on top inside individual controllers using the RolePermission /
 * Permission tables from the schema — that logic belongs close to the
 * business rule it protects, not in generic middleware.
 */
export function authorize(...allowedRoles: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!allowedRoles.includes(req.user.role as RoleName)) {
      return next(ApiError.forbidden());
    }
    return next();
  };
}
