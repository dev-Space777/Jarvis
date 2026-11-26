package jarvis.dao;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Properties;

/**
 * Loads JDBC settings once and creates connections on demand.
 * The configuration path can be overridden with {@code jarvis.db.config}.
 */
public final class DatabaseConnection {

    private static final DatabaseConnection INSTANCE = new DatabaseConnection();

    private final Path configPath;
    private volatile Properties configuration;

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
            try {
                Class.forName(driver.trim());
            } catch (ClassNotFoundException e) {
                throw new IllegalStateException(
                        "JDBC driver class '" + driver.trim() + "' was not found on the classpath.", e);
            }
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
}
