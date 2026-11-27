import jarvis.controller.AssignmentController;
import jarvis.dao.AssignmentDAO;
import jarvis.dao.JdbcAssignmentDAO;
import jarvis.service.AssignmentService;
import com.sun.net.httpserver.HttpServer;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

public class Main {
    public static void main(String[] args) throws Exception {
        // ── Assemble the backend stack ────────────────────────
        AssignmentDAO dao = new JdbcAssignmentDAO();
        AssignmentService service = new AssignmentService(dao);
        AssignmentController ctrl = new AssignmentController(service);

        // ── Initialize built-in HTTP Server on port 8080 ──────
        HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);

        // 1. API Route (Connecting Arvind's JS to your Controller)
        server.createContext("/api/assignments", (exchange -> {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");

            String method = exchange.getRequestMethod();
            String response = "";
            int statusCode = 200;

            try {
                if ("GET".equals(method)) {
                    response = ctrl.listAssignments().toString();
                }
            } catch (Exception e) {
                statusCode = 500;
                response = "{\"error\": \"Internal Server Error\"}";
            }

            exchange.sendResponseHeaders(statusCode, response.getBytes().length);
            OutputStream os = exchange.getResponseBody();
            os.write(response.getBytes());
            os.close();
        }));

        // 2. Static File Route (Serving Arvind's HTML/CSS/JS)
        server.createContext("/", (exchange -> {
            String path = exchange.getRequestURI().getPath();
            if (path.equals("/"))
                path = "/index.html";
            Path filePath = Paths.get("static" + path);

            if (Files.exists(filePath)) {
                byte[] bytes = Files.readAllBytes(filePath);
                exchange.sendResponseHeaders(200, bytes.length);
                OutputStream os = exchange.getResponseBody();
                os.write(bytes);
                os.close();
            } else {
                exchange.sendResponseHeaders(404, -1);
            }
        }));

        server.setExecutor(null);
        server.start();
        System.out.println("Jarvis Server running! Open http://localhost:8080 in your browser.");
    }
}