import { SnakeNamingStrategy } from './snake-naming.strategy';

// 기대값은 옮겨 오기 전의 typeorm-naming-strategies 4.1.0 이 실제로 낸 결과다(2026-11-03, TypeORM 0.3.31).
// 하나라도 달라지면 이미 만들어진 DB 의 테이블·컬럼 이름과 어긋난다.
describe('SnakeNamingStrategy 이름 규칙 테스트', () => {
  const sut = new SnakeNamingStrategy();

  it('테이블 이름', () => {
    expect(sut.tableName('UserSocial', undefined)).toBe('user_social');
    expect(sut.tableName('User', 'custom_users')).toBe('custom_users');
    expect(sut.tableName('HTMLParser', undefined)).toBe('html_parser');
  });

  it('컬럼 이름 (embedded 접두어 포함)', () => {
    expect(sut.columnName('createdAt', undefined, [])).toBe('created_at');
    expect(sut.columnName('city', undefined, ['address'])).toBe('address_city');
    expect(sut.columnName('zipCode', undefined, ['homeAddress'])).toBe('home_address_zip_code');
    expect(sut.columnName('x', 'CustomName', ['a'])).toBe('a_CustomName');
    expect(sut.columnName('userId2', undefined, [])).toBe('user_id2');
  });

  it('관계·조인 컬럼 이름', () => {
    expect(sut.relationName('userProfile')).toBe('user_profile');
    expect(sut.joinColumnName('user', 'id')).toBe('user_id');
    expect(sut.joinColumnName('parentCategory', 'categoryId')).toBe('parent_category_category_id');
  });

  it('조인 테이블 이름과 그 컬럼', () => {
    expect(sut.joinTableName('user', 'role', 'roles', 'users')).toBe('user_roles_role');
    expect(sut.joinTableName('post', 'tag', 'meta.tags', 'posts')).toBe('post_meta_tags_tag');
    expect(sut.joinTableColumnName('user', 'id')).toBe('user_id');
    expect(sut.joinTableColumnName('user', 'id', 'userId')).toBe('user_user_id');
  });

  it('상속 부모 컬럼과 eager 조인 별칭', () => {
    expect(sut.classTableInheritanceParentColumnName('parentTable', 'id')).toBe('parent_table_id');
    expect(sut.eagerJoinRelationAlias('user', 'profile.photo')).toBe('user__profile_photo');
  });
});
