import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from './entities/user.entity';
import { Balance } from './entities/balance.entity';

export async function seedDatabase(dataSource: DataSource): Promise<void> {
  const userRepo = dataSource.getRepository(User);
  const balanceRepo = dataSource.getRepository(Balance);

  const existing = await userRepo.count();
  if (existing > 0) return;

  const passwordHash = await bcrypt.hash('password123', 10);

  const users = userRepo.create([
    {
      email: 'admin@example.com',
      passwordHash,
      firstName: 'System',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      locationId: 'LOC-001',
      isActive: true,
    },
    {
      email: 'manager@example.com',
      passwordHash,
      firstName: 'Jane',
      lastName: 'Smith',
      role: UserRole.MANAGER,
      locationId: 'LOC-001',
      isActive: true,
    },
    {
      email: 'employee@example.com',
      passwordHash,
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.EMPLOYEE,
      locationId: 'LOC-001',
      isActive: true,
    },
    {
      email: 'employee2@example.com',
      passwordHash,
      firstName: 'Alice',
      lastName: 'Johnson',
      role: UserRole.EMPLOYEE,
      locationId: 'LOC-002',
      isActive: true,
    },
  ]);

  const savedUsers = await userRepo.save(users);

  // Set manager relationship
  const emp = savedUsers.find((u) => u.email === 'employee@example.com')!;
  const emp2 = savedUsers.find((u) => u.email === 'employee2@example.com')!;
  const mgr = savedUsers.find((u) => u.email === 'manager@example.com')!;
  emp.managerId = mgr.id;
  emp2.managerId = mgr.id;
  await userRepo.save([emp, emp2]);

  // Seed balances
  const balances = balanceRepo.create([
    {
      employeeId: emp.id,
      locationId: 'LOC-001',
      leaveType: 'ANNUAL',
      totalDays: 20,
      usedDays: 3,
      pendingDays: 0,
      lastSyncedAt: new Date(),
    },
    {
      employeeId: emp.id,
      locationId: 'LOC-001',
      leaveType: 'SICK',
      totalDays: 10,
      usedDays: 1,
      pendingDays: 0,
      lastSyncedAt: new Date(),
    },
    {
      employeeId: emp2.id,
      locationId: 'LOC-002',
      leaveType: 'ANNUAL',
      totalDays: 15,
      usedDays: 0,
      pendingDays: 0,
      lastSyncedAt: new Date(),
    },
  ]);

  await balanceRepo.save(balances);
  console.log('Database seeded successfully');
}
