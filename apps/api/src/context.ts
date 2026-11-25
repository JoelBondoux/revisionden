import type { ParentContext } from './families';
import type { OperatorContext } from './operator/bridge';

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
    /** Set by the operator bridge (AppDeck) on /operator/appdeck routes. */
    operator: OperatorContext;
  };
}
