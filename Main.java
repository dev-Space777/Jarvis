
import java.util.ArrayList;
import java.util.Scanner;

class Assignment {
    int id;
    String subject;
    String title;
    String dueDate;
    boolean completed;

    // Constructor
    Assignment(int id, String subject, String title, String dueDate) {
        this.id = id;
        this.subject = subject;
        this.title = title;
        this.dueDate = dueDate;
        this.completed = false;
    }

    // Display assignment details
    void display() {
        System.out.println("-----------------------------");
        System.out.println("ID: " + id);
        System.out.println("Subject: " + subject);
        System.out.println("Title: " + title);
        System.out.println("Due Date: " + dueDate);
        System.out.println("Status: " +
                (completed ? "Completed" : "Pending"));
    }
}

public class Main {

    static ArrayList<Assignment> assignments =
            new ArrayList<>();

    static Scanner sc = new Scanner(System.in);

    static int nextId = 1;

    // Add assignment
    static void addAssignment() {

        System.out.print("Enter subject: ");
        String subject = sc.nextLine();

        System.out.print("Enter assignment title: ");
        String title = sc.nextLine();

        System.out.print("Enter due date: ");
        String dueDate = sc.nextLine();

        Assignment a = new Assignment(
                nextId++, subject, title, dueDate
        );

        assignments.add(a);

        System.out.println("Assignment added successfully!");
    }

    // View assignments
    static void viewAssignments() {

        if (assignments.isEmpty()) {
            System.out.println("No assignments found.");
            return;
        }

        for (Assignment a : assignments) {
            a.display();
        }
    }

    // Mark assignment completed
    static void markCompleted() {

        System.out.print("Enter assignment ID: ");
        int id = sc.nextInt();
        sc.nextLine();

        for (Assignment a : assignments) {

            if (a.id == id) {
                a.completed = true;
                System.out.println("Assignment marked as completed!");
                return;
            }
        }

        System.out.println("Assignment not found.");
    }

    // Delete assignment
    static void deleteAssignment() {

        System.out.print("Enter assignment ID: ");
        int id = sc.nextInt();
        sc.nextLine();

        for (Assignment a : assignments) {

            if (a.id == id) {
                assignments.remove(a);
                System.out.println("Assignment deleted!");
                return;
            }
        }

        System.out.println("Assignment not found.");
    }

    // Main method
    public static void main(String[] args) {

        int choice;

        do {

            System.out.println("\n===== ASSIGNMENT TRACKER =====");
            System.out.println("1. Add Assignment");
            System.out.println("2. View Assignments");
            System.out.println("3. Mark as Completed");
            System.out.println("4. Delete Assignment");
            System.out.println("5. Exit");

            System.out.print("Enter your choice: ");
            choice = sc.nextInt();
            sc.nextLine();

            switch (choice) {

                case 1:
                    addAssignment();
                    break;

                case 2:
                    viewAssignments();
                    break;

                case 3:
                    markCompleted();
                    break;

                case 4:
                    deleteAssignment();
                    break;

                case 5:
                    System.out.println("Thank you for using Assignment Tracker!");
                    break;

                default:
                    System.out.println("Invalid choice. Try again.");
            }

        } while (choice != 5);

        sc.close();
    }
}
