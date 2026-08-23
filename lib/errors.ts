export function friendlyError(err: unknown, fallback: string): string {
  if (!err) return fallback;
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes('network') || lower.includes('failed to fetch') || (lower.includes('fetch') && lower.includes('error'))) {
    return '인터넷 연결을 확인해주세요. 네트워크가 일시적으로 불안정합니다.';
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
  }
  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('api key')) {
    return 'AI 분석 서비스 인증에 실패했습니다. 설정에서 API 키를 확인해주세요.';
  }
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('quota')) {
    return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
  }
  if (lower.includes('500') || lower.includes('502') || lower.includes('503') || lower.includes('server')) {
    return '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
  }
  if (lower.includes('upload') || lower.includes('storage')) {
    return '이미지 업로드에 실패했습니다. 네트워크 연결을 확인해주세요.';
  }
  if (lower.includes('capture') || lower.includes('camera')) {
    return '사진 촬영에 실패했습니다. 카메라를 다시 시도해주세요.';
  }

  return fallback;
}
