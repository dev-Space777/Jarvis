package jarvis.dao;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.Driver;
import java.sql.DriverManager;
import java.sql.DriverPropertyInfo;
import java.sql.SQLException;
import java.sql.SQLFeatureNotSupportedException;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import java.util.logging.Logger;

/**
 * Loads JDBC settings once and creates connections on demand.
 * The configuration path can be overridden with {@code jarvis.db.config}.
 */
public final class DatabaseConnection {

    private static final DatabaseConnection INSTANCE = new DatabaseConnection();

    private final Path configPath;
    private volatile Properties configuration;
    private volatile boolean driverRegistered;

    private DatabaseConnection() {
        String configuredPath = System.getProperty("jarvis.db.config", "db.properties");
        configPath = Paths.get(configuredPath);
    }

    public static DatabaseConnection getInstance() {
        return INSTANCE;
    }

    public Connection getConnection() throws SQLException {
        Properties settings = getConfiguration();
        String driver = settings.getProperty("jdbc.driver");
        if (driver != null && !driver.trim().isEmpty()) {
            ensureDriverLoaded(driver.trim());
        }

        Properties connectionProperties = new Properties();
        String username = settings.getProperty("jdbc.username");
        String password = settings.getProperty("jdbc.password");
        if (username != null) {
            connectionProperties.setProperty("user", username);
        }
        if (password != null) {
            connectionProperties.setProperty("password", password);
        }
        return DriverManager.getConnection(settings.getProperty("jdbc.url"), connectionProperties);
    }

    private Properties getConfiguration() {
        Properties loaded = configuration;
        if (loaded == null) {
            synchronized (this) {
                loaded = configuration;
                if (loaded == null) {
                    loaded = loadConfiguration();
                    configuration = loaded;
                }
            }
        }
        return loaded;
    }

    private Properties loadConfiguration() {
        Properties loaded = new Properties();
        try (InputStream input = Files.newInputStream(configPath)) {
            loaded.load(input);
        } catch (IOException e) {
            throw new IllegalStateException(
                    "Could not read JDBC configuration file '" + configPath.toAbsolutePath()
                            + "'. Copy db.properties.example to db.properties and configure it.", e);
        }

        String url = loaded.getProperty("jdbc.url");
        if (url == null || url.trim().isEmpty()) {
            throw new IllegalStateException(
                    "JDBC configuration file '" + configPath.toAbsolutePath()
                            + "' must define a non-empty jdbc.url.");
        }
        loaded.setProperty("jdbc.url", url.trim());
        return loaded;
    }

    private void ensureDriverLoaded(String driverClassName) {
        if (driverRegistered) {
            return;
        }
        synchronized (this) {
            if (driverRegistered) {
                return;
            }
            try {
                Class.forName(driverClassName);
                driverRegistered = true;
                return;
            } catch (ClassNotFoundException ignored) {
                // Fall back to loading JARs from local lib directories
            }

            List<URL> jarUrls = findLibJars();
            if (!jarUrls.isEmpty()) {
                try {
                    URLClassLoader loader = new URLClassLoader(
                            jarUrls.toArray(new URL[0]),
                            DatabaseConnection.class.getClassLoader());
                    Driver driver = (Driver) Class.forName(driverClassName, true, loader)
                            .getDeclaredConstructor()
                            .newInstance();
                    DriverManager.registerDriver(new DriverShim(driver));
                    driverRegistered = true;
                    return;
                } catch (Exception e) {
                    throw new IllegalStateException(
                            "Failed to load JDBC driver '" + driverClassName + "' from local lib JARs.", e);
                }
            }

            throw new IllegalStateException(
                    "JDBC driver class '" + driverClassName + "' was not found on the classpath or in src/jarvis/lib.");
        }
    }

    private static List<URL> findLibJars() {
        List<URL> urls = new ArrayList<>();
        File[] candidates = { new File("src/jarvis/lib"), new File("lib") };
        for (File dir : candidates) {
            if (dir.isDirectory()) {
                File[] files = dir.listFiles((d, name) -> name.endsWith(".jar"));
                if (files != null) {
                    for (File file : files) {
                        try {
                            urls.add(file.toURI().toURL());
                        } catch (Exception ignored) {
                        }
                    }
                }
            }
        }
        return urls;
    }

    /**
     * Wraps a {@link Driver} loaded from a child {@link URLClassLoader} so
     * {@link DriverManager} accepts it when the JAR is not on the system classpath.
     */
    private static final class DriverShim implements Driver {
        private final Driver delegate;

        DriverShim(Driver delegate) {
            this.delegate = delegate;
        }

        @Override
        public Connection connect(String url, Properties info) throws SQLException {
            return delegate.connect(url, info);
        }

        @Override
        public boolean acceptsURL(String url) throws SQLException {
            return delegate.acceptsURL(url);
        }

        @Override
        public DriverPropertyInfo[] getPropertyInfo(String url, Properties info) throws SQLException {
            return delegate.getPropertyInfo(url, info);
        }

        @Override
        public int getMajorVersion() {
            return delegate.getMajorVersion();
        }

        @Override
        public int getMinorVersion() {
            return delegate.getMinorVersion();
        }

        @Override
        public boolean jdbcCompliant() {
            return delegate.jdbcCompliant();
        }

        @Override
        public Logger getParentLogger() throws SQLFeatureNotSupportedException {
            return delegate.getParentLogger();
        }
    }
}
