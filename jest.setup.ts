// Mock react-native Platform for tests
jest.mock('react-native', () => ({
  Platform: {
    OS: 'web',
    select: (obj: Record<string, unknown>) => obj.web ?? obj.ios ?? obj.android ?? obj.default,
  },
}));
