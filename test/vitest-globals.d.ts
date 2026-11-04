// 테스트 파일에서 describe·it·expect·vi 를 import 없이 쓰기 위한 타입 (vitest.config 의 globals: true).
// tsconfig.json 의 types 에 넣으면 build(tsconfig.build.json 이 상속)에도 테스트 전역 타입이 들어가서 test 폴더에만 둔다.
/// <reference types="vitest/globals" />
