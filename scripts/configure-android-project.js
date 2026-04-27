#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Load APP_CONFIG from app.config.ts dynamically
let APP_CONFIG
try {
  // Try ts-node / tsx style first
  APP_CONFIG = require('../app.config').APP_CONFIG
} catch {
  // Fallback: read and parse app.config.ts manually
  const src = fs.readFileSync(path.join(__dirname, '../app.config.ts'), 'utf8')
  const packageMatch = src.match(/packageName:\s*'([^']+)'/)
  const nameMatch = src.match(/name:\s*'([^']+)'/)
  APP_CONFIG = {
    packageName: packageMatch ? packageMatch[1] : 'com.payment_hub.demo',
    name: nameMatch ? nameMatch[1] : 'Payment Hub Demo',
  }
}

const projectRoot = path.join(__dirname, '..')
const tauriConfigPath = path.join(projectRoot, 'src-tauri', 'tauri.conf.json')
const androidRoot = path.join(projectRoot, 'src-tauri', 'gen', 'android')
const androidApp = path.join(androidRoot, 'app')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function ensureContains(content, snippet, insertAfter) {
  if (content.includes(snippet)) return content
  const index = content.indexOf(insertAfter)
  if (index === -1) {
    return `${content.trimEnd()}\n${snippet}\n`
  }
  const insertIndex = index + insertAfter.length
  return `${content.slice(0, insertIndex)}\n${snippet}${content.slice(insertIndex)}`
}

function writeIfChanged(filePath, content) {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null
  if (current === content) return
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

function configureGradle() {
  const rootBuildGradlePath = path.join(androidRoot, 'build.gradle.kts')
  let rootContent = fs.readFileSync(rootBuildGradlePath, 'utf8')

  rootContent = ensureContains(
    rootContent,
    '        classpath("com.google.gms:google-services:4.4.2")',
    '    dependencies {'
  )

  writeIfChanged(rootBuildGradlePath, rootContent)

  const buildGradlePath = path.join(androidApp, 'build.gradle.kts')
  let content = fs.readFileSync(buildGradlePath, 'utf8')

  content = content.replace('    id("com.google.gms.google-services") version "4.4.2"', '    id("com.google.gms.google-services")')

  content = ensureContains(
    content,
    '    id("com.google.gms.google-services")',
    '    id("org.jetbrains.kotlin.android")'
  )

  const dependencies = [
    '    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))',
    '    implementation("com.google.firebase:firebase-analytics")',
    '    implementation("com.google.firebase:firebase-messaging")',
    '    implementation("com.google.android.play:review-ktx:2.0.2")',
  ]

  for (const dependency of dependencies) {
    content = ensureContains(content, dependency, 'dependencies {')
  }

  writeIfChanged(buildGradlePath, content)
}

function configureMainActivity(packageName) {
  const packagePath = packageName.split('.').join(path.sep)
  const mainActivityPath = path.join(androidApp, 'src', 'main', 'java', packagePath, 'MainActivity.kt')
  let content = fs.readFileSync(mainActivityPath, 'utf8')

  if (!content.includes('AndroidWebViewBridgeInstaller.install(this)')) {
    content = content.replace(
      '    super.onCreate(savedInstanceState)',
      '    super.onCreate(savedInstanceState)\n    AndroidWebViewBridgeInstaller.install(this)'
    )
  }

  writeIfChanged(mainActivityPath, content)
}

function copyGoogleServices() {
  const source = path.join(projectRoot, 'firebase', 'google-services.json')
  const destination = path.join(androidApp, 'google-services.json')
  if (!fs.existsSync(source)) return
  fs.copyFileSync(source, destination)
}

function kotlinFile(packageName, body) {
  return `package ${packageName}\n\n${body}`
}

function configureNativeFiles(packageName) {
  const packagePath = packageName.split('.').join(path.sep)
  const nativeDir = path.join(androidApp, 'src', 'main', 'java', packagePath)
  const appName = APP_CONFIG.name || packageName

  writeIfChanged(
    path.join(nativeDir, 'FirebaseAnalyticsBridge.kt'),
    kotlinFile(packageName, `import android.os.Bundle
import android.webkit.JavascriptInterface
import com.google.firebase.analytics.FirebaseAnalytics
import org.json.JSONObject

class FirebaseAnalyticsBridge(private val analytics: FirebaseAnalytics) {
    @JavascriptInterface
    fun logEvent(name: String, paramsJson: String) {
        val bundle = Bundle()
        try {
            val json = JSONObject(paramsJson)
            json.keys().forEach { key ->
                when (val value = json.get(key)) {
                    is String -> bundle.putString(key, value)
                    is Int -> bundle.putLong(key, value.toLong())
                    is Long -> bundle.putLong(key, value)
                    is Double -> bundle.putDouble(key, value)
                    is Boolean -> bundle.putBoolean(key, value)
                }
            }
        } catch (_: Exception) {
        }
        analytics.logEvent(name, bundle)
    }
}
`)
  )

  writeIfChanged(
    path.join(nativeDir, 'AndroidReviewBridge.kt'),
    kotlinFile(packageName, `import android.app.Activity
import android.util.Log
import android.webkit.JavascriptInterface
import com.google.android.gms.tasks.Tasks
import com.google.android.play.core.review.ReviewManagerFactory
import java.util.concurrent.TimeUnit

class AndroidReviewBridge(private val activity: Activity) {
    @JavascriptInterface
    fun requestReview(): Boolean {
        if (activity.isFinishing || activity.isDestroyed) {
            return false
        }

        return try {
            val manager = ReviewManagerFactory.create(activity)
            val reviewInfo = Tasks.await(manager.requestReviewFlow(), 2, TimeUnit.SECONDS)
            activity.runOnUiThread {
                manager.launchReviewFlow(activity, reviewInfo)
            }
            true
        } catch (error: Exception) {
            Log.w("AndroidReviewBridge", "In-app review unavailable", error)
            false
        }
    }
}
`)
  )

  writeIfChanged(
    path.join(nativeDir, 'AndroidWebViewBridgeInstaller.kt'),
    kotlinFile(packageName, `import android.app.Activity
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import com.google.firebase.analytics.FirebaseAnalytics

object AndroidWebViewBridgeInstaller {
    fun install(activity: Activity, attemptsRemaining: Int = 8) {
        val root = activity.window?.decorView ?: return

        root.post {
            val webView = findWebView(root)
            if (webView != null) {
                webView.settings.javaScriptEnabled = true
                webView.addJavascriptInterface(
                    FirebaseAnalyticsBridge(FirebaseAnalytics.getInstance(activity.applicationContext)),
                    "FirebaseAnalytics"
                )
                webView.addJavascriptInterface(AndroidReviewBridge(activity), "AndroidReview")
            } else if (attemptsRemaining > 0) {
                root.postDelayed({ install(activity, attemptsRemaining - 1) }, 400)
            }
        }
    }

    private fun findWebView(view: View): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup) {
            for (index in 0 until view.childCount) {
                val match = findWebView(view.getChildAt(index))
                if (match != null) return match
            }
        }
        return null
    }
}
`)
  )

  console.log(`Native files configured for app: ${appName} (${packageName})`)
}

function main() {
  if (!fs.existsSync(tauriConfigPath)) {
    throw new Error(`Tauri config not found: ${tauriConfigPath}`)
  }

  if (!fs.existsSync(androidApp)) {
    throw new Error(`Android project not initialized: ${androidApp}\nRun "npm run tauri:android:init" first.`)
  }

  const tauriConfig = readJson(tauriConfigPath)
  // Use APP_CONFIG.packageName as primary source, fall back to tauri.conf.json identifier
  const packageName = APP_CONFIG.packageName || tauriConfig.identifier

  configureGradle()
  configureMainActivity(packageName)
  configureNativeFiles(packageName)
  copyGoogleServices()

  console.log('Android project configured successfully.')
}

main()
