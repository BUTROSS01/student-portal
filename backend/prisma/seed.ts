import { PrismaClient, RoleName } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  SUPER_ADMIN: "Full control over the entire system",
  MANAGEMENT: "Institution-wide visibility and reporting",
  ACADEMIC_ADMIN: "Registrar functions: enrolment, results, transcripts",
  LECTURER: "Class-level teaching, attendance, marks, materials",
  FINANCE: "Fee accounts, payment verification, receipts",
  STUDENT: "Personal academic and financial dashboard",
  PARENT: "Read-only visibility into a linked student's record",
};

// A starter permission set — expanded as each subsequent module is built.
const PERMISSIONS: { code: string; description: string; roles: RoleName[] }[] = [
  { code: "users.manage", description: "Create, edit, deactivate user accounts", roles: ["SUPER_ADMIN"] },
  { code: "students.register", description: "Register new students", roles: ["SUPER_ADMIN", "ACADEMIC_ADMIN"] },
  { code: "structure.manage", description: "Manage campuses and departments", roles: ["SUPER_ADMIN"] },
  { code: "curriculum.manage", description: "Manage programmes and subjects", roles: ["SUPER_ADMIN"] },
  { code: "classes.manage", description: "Create classes and assign lecturers", roles: ["SUPER_ADMIN", "ACADEMIC_ADMIN"] },
  { code: "students.enrol", description: "Allocate students to subjects", roles: ["SUPER_ADMIN", "ACADEMIC_ADMIN"] },
  { code: "results.enter", description: "Enter marks for assigned classes", roles: ["LECTURER"] },
  { code: "results.approve", description: "Approve, reject, and publish results", roles: ["ACADEMIC_ADMIN"] },
  { code: "fees.manage", description: "Create and adjust fee accounts", roles: ["FINANCE", "SUPER_ADMIN"] },
  { code: "fees.verify", description: "Verify proof-of-payment submissions", roles: ["FINANCE"] },
  { code: "attendance.record", description: "Record daily attendance for assigned classes", roles: ["LECTURER"] },
  { code: "announcements.publish", description: "Publish announcements to students and parents", roles: ["SUPER_ADMIN", "MANAGEMENT", "ACADEMIC_ADMIN", "LECTURER"] },
  { code: "timetables.manage", description: "Create and remove timetable entries", roles: ["SUPER_ADMIN", "ACADEMIC_ADMIN"] },
  { code: "audit_log.view", description: "View the system-wide audit log", roles: ["SUPER_ADMIN"] },
  { code: "reports.view_institutional", description: "View institution-wide KPIs and reports", roles: ["MANAGEMENT", "SUPER_ADMIN"] },
];

async function main() {
  for (const name of Object.values(RoleName)) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, description: ROLE_DESCRIPTIONS[name] },
    });
  }

  for (const perm of PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: { code: perm.code, description: perm.description },
    });

    for (const roleName of perm.roles) {
      const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  // A single break-glass Super Admin account so the college's IT lead can
  // log in and start creating real staff accounts. CHANGE THIS PASSWORD
  // IMMEDIATELY after first login (mustChangePassword enforces this).
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: "SUPER_ADMIN" } });
  const existingAdmin = await prisma.user.findUnique({ where: { email: "admin@tshwanecitycollege.ac.za" } });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("ChangeMe!2026#Portal", 12);
    await prisma.user.create({
      data: {
        email: "admin@tshwanecitycollege.ac.za",
        passwordHash,
        roleId: superAdminRole.id,
        status: "ACTIVE",
        mustChangePassword: true,
      },
    });
    console.log("Seeded initial Super Admin: admin@tshwanecitycollege.ac.za / ChangeMe!2026#Portal");
  }

  console.log("Seed complete: roles, permissions, and initial admin ready.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
