const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = (env, argv) => {
  const isDevelopment = argv.mode === 'development';

  return {
    mode: isDevelopment ? 'development' : 'production',
    entry: './src/index.tsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'bundle.[contenthash].js',
      clean: true,
    },
    devtool: isDevelopment ? 'eval-source-map' : 'source-map',
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.jsx'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@huahuo/kernel-wasm': path.resolve(__dirname, '../packages/kernel-wasm/index.js'),
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              compilerOptions: {
                noEmit: false,
              },
            },
          },
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: 'asset/resource',
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: 'asset/resource',
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
      }),
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(isDevelopment ? 'development' : 'production'),
      }),
    ],
    devServer: {
      setupMiddlewares: (middlewares, devServer) => {
        const fs = require('fs');
        const path = require('path');
        // Endpoint to receive playback logs from browser during dev
        devServer.app.post('/__hh_playback_log', (req, res) => {
          let body = '';
          req.setEncoding('utf8');
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const p = path.join('/tmp', 'hh_playback.log');
              const entry = `[${new Date().toISOString()}] ${body}\n`;
              fs.appendFileSync(p, entry, { encoding: 'utf8' });
            } catch (e) {
              console.warn('[devServer] failed to write playback log', e);
            }
            res.status(204).end();
          });
        });
        return middlewares;
      },
      static: {
        directory: path.join(__dirname, 'public'),
      },
      compress: true,
      port: 3006,
      hot: true,
      open: true,
      historyApiFallback: true,
    },
  };
};

