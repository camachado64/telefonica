export type Required<T, U extends keyof T> = T & { [key in U]-?: T[key] };

export class TypeUtils {
  constructor() {
    // This class is a utility class for type checking. It cannot be instantiated
    throw new Error("TypeUtils is a utility class and cannot be instantiated.");
  }

  public static isString(value: any): value is string {
    // Checks if the value is a string
    return typeof value === "string" || value instanceof String;
  }
}
