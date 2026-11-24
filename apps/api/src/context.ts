import type { ParentContext } from './families';

export interface StudentContext {
  studentId: string;
  familyId: string;
  deviceId: string;
}

export interface AppEnv {
  Variables: {
    parent: ParentContext;
    parentEmail: string;
    student: StudentContext;
  };
}
