const { withGradleProperties } = require('@expo/config-plugins');

function withOptimizedGradle(config) {
  return withGradleProperties(config, (config) => {
    const props = config.modResults;

    for (const prop of props) {
      if (prop.type === 'property' && prop.key === 'org.gradle.jvmargs') {
        prop.value = '-Xmx4096m -XX:MaxMetaspaceSize=1024m';
      }
      if (prop.type === 'property' && prop.key === 'reactNativeArchitectures') {
        prop.value = 'arm64-v8a';
      }
    }

    return config;
  });
}

module.exports = withOptimizedGradle;
