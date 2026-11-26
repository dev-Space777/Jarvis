import jarvis.controller.AssignmentController;
import jarvis.dao.AssignmentDAO;
import jarvis.dao.JdbcAssignmentDAO;
import jarvis.model.Assignment;
import jarvis.service.AssignmentService;

import java.util.List;
import java.util.Scanner;

/**
 * CLI bootstrap – wires Controller → Service → DAO and
 * provides a text menu for quick local testing.
 *
 * <p>
 * When Arvind's frontend is ready this class can be replaced
 * by a Servlet or Spring Boot application class; the Controller,
 * Service, and DAO layers stay untouched.
 * </p>
 */
public class Main {

    public static void main(String[] args) {

        // ── Assemble the backend stack ────────────────────────
        AssignmentDAO dao = new JdbcAssignmentDAO();
        AssignmentService service = new AssignmentService(dao);
        AssignmentController ctrl = new AssignmentController(service);

        Scanner sc = new Scanner(System.in);
        int choice = 0;

        do {
            System.out.println("\n===== JARVIS – ASSIGNMENT TRACKER =====");
            System.out.println("1. Add Assignment");
            System.out.println("2. View Assignments (priority-sorted)");
            System.out.println("3. Mark as Completed");
            System.out.println("4. Delete Assignment");
            System.out.println("5. Exit");
            System.out.print("Enter your choice: ");

            // Safely parse the menu choice
            try {
                choice = Integer.parseInt(sc.nextLine());
            } catch (NumberFormatException e) {
                System.out.println("Invalid input! Please enter a number between 1 and 5.");
                continue; // Skip the switch statement and show the menu again
            }

            switch (choice) {
                case 1:
                    System.out.print("Subject: ");
                    String subject = sc.nextLine();

                    System.out.print("Title: ");
                    String title = sc.nextLine();

                    System.out.print("Due date (yyyy-MM-dd): ");
                    String dueDate = sc.nextLine();

                    System.out.print("Difficulty (1-5): ");
                    String diff = sc.nextLine();

                    System.out.println(ctrl.createAssignment(subject, title, dueDate, diff));
                    break;

                case 2:
                    List<Assignment> list = ctrl.listAssignments();
                    if (list.isEmpty()) {
                        System.out.println("No assignments found.");
                    } else {
                        list.forEach(System.out::println);
                    }
                    break;

                case 3:
                    System.out.print("Enter assignment ID (number): ");
                    try {
                        int idToComplete = Integer.parseInt(sc.nextLine());
                        System.out.println(ctrl.markCompleted(idToComplete));
                    } catch (NumberFormatException e) {
                        System.out.println("Invalid input! You must enter the numeric ID (e.g., 1).");
                    }
                    break;

                case 4:
                    System.out.print("Enter assignment ID (number): ");
                    try {
                        int idToDelete = Integer.parseInt(sc.nextLine());
                        System.out.println(ctrl.deleteAssignment(idToDelete));
                    } catch (NumberFormatException e) {
                        System.out.println("Invalid input! You must enter the numeric ID (e.g., 1).");
                    }
                    break;

                case 5:
                    System.out.println("Thank you for using Jarvis – Assignment Tracker!");
                    break;

                default:
                    System.out.println("Invalid choice. Try again.");
                    break;
            }

        } while (choice != 5);

        sc.close();
    }
}