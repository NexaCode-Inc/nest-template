import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';

/*
 * 엔티티·속성 이름을 snake_case 테이블·컬럼 이름으로 바꾸는 TypeORM 이름 규칙.
 *
 * typeorm-naming-strategies 4.1.0 의 SnakeNamingStrategy 를 그대로 옮겼다
 * (MIT License, https://github.com/tonivj5/typeorm-naming-strategies).
 * 그 패키지는 2022 년 이후 새 판이 없고 TypeORM 0.3 까지만 허용해서 TypeORM 1.x 와 함께 설치할 수 없다.
 * 이미 만들어진 DB 의 이름과 어긋나지 않도록 결과가 원본과 같아야 한다 — snake-naming.strategy.spec.ts 가 고정한다.
 */

// TypeORM 0.3 util/StringUtils 의 snakeCase 와 같다. TypeORM 내부 경로를 import 하지 않으려고 옮겨 둔다.
export const snakeCase = (str: string): string =>
  str
    // ABc -> a_bc
    .replace(/([A-Z])([A-Z])([a-z])/g, '$1_$2$3')
    // aC -> a_c
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();

export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  tableName(className: string, customName: string | undefined): string {
    return customName ? customName : snakeCase(className);
  }

  columnName(propertyName: string, customName: string | undefined, embeddedPrefixes: string[]): string {
    return snakeCase(embeddedPrefixes.concat('').join('_')) + (customName ? customName : snakeCase(propertyName));
  }

  relationName(propertyName: string): string {
    return snakeCase(propertyName);
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    return snakeCase(relationName + '_' + referencedColumnName);
  }

  joinTableName(
    firstTableName: string,
    secondTableName: string,
    firstPropertyName: string,
    _secondPropertyName: string,
  ): string {
    return snakeCase(firstTableName + '_' + firstPropertyName.replace(/\./gi, '_') + '_' + secondTableName);
  }

  joinTableColumnName(tableName: string, propertyName: string, columnName?: string): string {
    return snakeCase(tableName + '_' + (columnName ? columnName : propertyName));
  }

  classTableInheritanceParentColumnName(parentTableName: string, parentTableIdPropertyName: string): string {
    return snakeCase(parentTableName + '_' + parentTableIdPropertyName);
  }

  eagerJoinRelationAlias(alias: string, propertyPath: string): string {
    return alias + '__' + propertyPath.replace('.', '_');
  }
}
