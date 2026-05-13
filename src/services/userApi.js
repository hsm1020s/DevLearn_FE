/**
 * @fileoverview 현재 로그인 사용자 본인 프로필 API 클라이언트.
 *
 * 백엔드의 `/api/users/me` 컨트롤러와 1:1 대응한다.
 * ApiResponse 래핑 규칙에 따라 모든 응답에서 `data.data` 가 실제 페이로드.
 */
import api from './api';

/**
 * 현재 로그인 사용자 프로필 조회.
 * @returns {Promise<{ id: string, email: string, name: string, role: string, createdAt: string }>}
 */
export async function getMe() {
  const { data } = await api.get('/users/me');
  return data.data;
}

/**
 * 사용자 이름 변경.
 * @param {{ name: string }} payload
 * @returns {Promise<{ id: string, email: string, name: string, role: string, createdAt: string }>}
 */
export async function updateProfile(payload) {
  const { data } = await api.patch('/users/me', payload);
  return data.data;
}

/**
 * 비밀번호 변경. 현재 비밀번호 검증 실패 시 401.
 * @param {{ currentPassword: string, newPassword: string }} payload
 */
export async function changePassword(payload) {
  await api.patch('/users/me/password', payload);
}

/**
 * 회원 탈퇴. 본인 확인용 비밀번호 검증 실패 시 401.
 * @param {{ password: string }} payload
 */
export async function withdraw(payload) {
  // axios delete 에 body 를 보낼 때는 두 번째 인자 객체의 data 필드에 실어야 한다.
  await api.delete('/users/me', { data: payload });
}
