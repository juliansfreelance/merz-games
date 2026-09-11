import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import org.apache.tools.ant.taskdefs.condition.Os
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.logging.LogLevel
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction

open class BuildTask : DefaultTask() {
    @Input
    var rootDirRel: String? = null
    @Input
    var target: String? = null
    @Input
    var release: Boolean? = null

    @TaskAction
    fun assemble() {
        if (ensureJniLibPresent()) {
            return
        }

        val executable = """npm""";
        try {
            runTauriCli(executable)
            if (ensureJniLibPresent()) return
        } catch (e: Exception) {
            if (Os.isFamily(Os.FAMILY_WINDOWS)) {
                val fallbacks = listOf(
                    "$executable.exe",
                    "$executable.cmd",
                    "$executable.bat",
                )

                var lastException: Exception = e
                for (fallback in fallbacks) {
                    try {
                        runTauriCli(fallback)
                        if (ensureJniLibPresent()) return
                    } catch (fallbackException: Exception) {
                        lastException = fallbackException
                    }
                }
                if (linkLibFallback()) {
                    logger.warn(
                        "Tauri CLI failed; linked/copied native lib via BuildTask fallback (${lastException.message})"
                    )
                    return
                }
                throw lastException
            } else {
                throw e;
            }
        }

        if (!ensureJniLibPresent() && !linkLibFallback()) {
            throw GradleException("Native lib for target=$target was not produced")
        }
    }

    fun runTauriCli(executable: String) {
        val rootDirRel = rootDirRel ?: throw GradleException("rootDirRel cannot be null")
        val target = target ?: throw GradleException("target cannot be null")
        val release = release ?: throw GradleException("release cannot be null")
        val args = listOf("run", "--", "tauri", "android", "android-studio-script");

        project.exec {
            workingDir(File(project.projectDir, rootDirRel))
            executable(executable)
            args(args)
            if (project.logger.isEnabled(LogLevel.DEBUG)) {
                args("-vv")
            } else if (project.logger.isEnabled(LogLevel.INFO)) {
                args("-v")
            }
            if (release) {
                args("--release")
            }
            args(listOf("--target", target))
        }.assertNormalExitValue()
    }

    private fun targetMeta(target: String): Pair<String, String>? = when (target) {
        "aarch64" -> "arm64-v8a" to "aarch64-linux-android"
        "armv7" -> "armeabi-v7a" to "armv7-linux-androideabi"
        "i686" -> "x86" to "i686-linux-android"
        "x86_64" -> "x86_64" to "x86_64-linux-android"
        else -> null
    }

    private fun jniLibFile(): File? {
        val target = target ?: return null
        val meta = targetMeta(target) ?: return null
        val (abi, _) = meta
        return File(project.projectDir, "src/main/jniLibs/$abi/libmerz_games.so")
    }

    private fun ensureJniLibPresent(): Boolean {
        val dst = jniLibFile() ?: return false
        if (dst.isFile && dst.length() > 0L) {
            logger.lifecycle("Using existing native lib ${dst.absolutePath}")
            return true
        }
        return linkLibFallback()
    }

    private fun linkLibFallback(): Boolean {
        val rootDirRel = rootDirRel ?: return false
        val target = target ?: return false
        val release = release ?: return false
        val meta = targetMeta(target) ?: return false
        val (abi, triple) = meta
        val profile = if (release) "release" else "debug"
        val rootDir = File(project.projectDir, rootDirRel).canonicalFile
        val soName = "libmerz_games.so"
        val src = File(rootDir, "target/$triple/$profile/$soName")
        if (!src.isFile) {
            logger.error("Fallback link failed: missing ${src.absolutePath}")
            return false
        }
        val jniDir = File(project.projectDir, "src/main/jniLibs/$abi")
        if (!jniDir.exists() && !jniDir.mkdirs()) {
            logger.error("Fallback link failed: cannot create ${jniDir.absolutePath}")
            return false
        }
        val dst = File(jniDir, soName)
        if (dst.exists()) {
            dst.delete()
        }
        return try {
            Files.createLink(dst.toPath(), src.toPath())
            logger.lifecycle("Hardlinked ${src.name} → ${dst.absolutePath}")
            true
        } catch (linkErr: Exception) {
            try {
                Files.copy(src.toPath(), dst.toPath(), StandardCopyOption.REPLACE_EXISTING)
                logger.lifecycle("Copied ${src.name} → ${dst.absolutePath} (${linkErr.message})")
                true
            } catch (copyErr: Exception) {
                logger.error("Fallback copy failed: ${copyErr.message}")
                false
            }
        }
    }
}
