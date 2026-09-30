import { Config } from '@remotion/cli/config'
import { webpackOverride } from './webpack-override'

// JPEG frames made the encoder emit full-range `yuvj420p` with BT.601 tags,
// which some players and transcoders reject or wash out; PNG + BT.709 gives
// standard limited-range yuv420p.
Config.setVideoImageFormat('png')
Config.setColorSpace('bt709')
Config.setPixelFormat('yuv420p')
Config.overrideWebpackConfig(webpackOverride)
