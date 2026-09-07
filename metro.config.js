const { getDefaultConfig } = require('expo/metro-config');
const { wrapWithReanimatedMetroConfig } = require('react-native-reanimated/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.resolverMainFields = ['browser', 'main', 'react-native'];

config.transformer.minifierConfig = {
  ...(config.transformer.minifierConfig || {}),
  keep_classnames: true,
  keep_fnames: true,
};

module.exports = wrapWithReanimatedMetroConfig(config);
