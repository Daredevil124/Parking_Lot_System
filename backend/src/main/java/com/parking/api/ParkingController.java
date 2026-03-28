package com.parking.api;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.CallableStatementCallback;
import org.springframework.jdbc.core.CallableStatementCreator;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*") // Allow frontend to connect
public class ParkingController {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * Dashboard View: Get total available slots
     */
    @GetMapping("/spots/available")
    public ResponseEntity<?> getAvailableSpots() {
        try {
            String sql = "SELECT COUNT(*) FROM ParkingSlot WHERE is_occupied = 'N'";
            Integer count = jdbcTemplate.queryForObject(sql, Integer.class);
            return ResponseEntity.ok(Collections.singletonMap("availableSpots", count != null ? count : 0));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    /**
     * Setup Info: Get details about parking lots, floors, and gates
     */
    @GetMapping("/setup-info")
    public ResponseEntity<?> getSetupInfo() {
        try {
            Map<String, Object> response = new HashMap<>();
            response.put("lots", jdbcTemplate.queryForList("SELECT lot_id as \"lotId\", name as \"name\", location as \"location\" FROM ParkingLot"));
            response.put("floors", jdbcTemplate.queryForList("SELECT floor_id as \"floorId\", lot_id as \"lotId\", floor_number as \"floorNumber\" FROM FLOOR"));
            response.put("gates", jdbcTemplate.queryForList("SELECT gate_id as \"gateId\", lot_id as \"lotId\", gate_type as \"gateType\" FROM GATE"));
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    /**
     * Get Pricing Rates
     */
    @GetMapping("/rates")
    public ResponseEntity<?> getRates() {
        try {
            List<Map<String, Object>> rates = jdbcTemplate.queryForList("SELECT vehicle_type as \"vehicleType\", hourly_rate as \"hourlyRate\" FROM PricingRule");
            return ResponseEntity.ok(rates);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    /**
     * Update Pricing Rate
     */
    @PutMapping("/rates")
    public ResponseEntity<?> updateRate(@RequestBody Map<String, Object> request) {
        try {
            String vehicleType = request.get("vehicleType").toString();
            Double hourlyRate = Double.valueOf(request.get("hourlyRate").toString());

            int updated = jdbcTemplate.update("UPDATE PricingRule SET hourly_rate = ? WHERE vehicle_type = ?", hourlyRate, vehicleType);

            if (updated == 0) {
                jdbcTemplate.update("INSERT INTO PricingRule (vehicle_type, hourly_rate) VALUES (?, ?)", vehicleType, hourlyRate);
            }

            return ResponseEntity.ok(Collections.singletonMap("message", "Rate updated successfully for " + vehicleType));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    /**
     * Dashboard View: Get all slots and their current status (with vehicle license plate if occupied)
     */
    @GetMapping("/spots")
    public ResponseEntity<?> getAllSpots() {
        try {
            String sql = "SELECT p.slot_id as \"spotId\", p.slot_type as \"spotType\", " +
                         "p.is_occupied as \"isOccupied\", v.vehicle_number as \"licensePlate\", " +
                         "t.ticket_id as \"transactionId\" " +
                         "FROM ParkingSlot p " +
                         "LEFT JOIN TICKET t ON p.slot_id = t.slot_id AND t.status = 'ACTIVE' " +
                         "LEFT JOIN VEHICLE v ON t.vehicle_id = v.vehicle_id " +
                         "ORDER BY p.slot_id";
            List<Map<String, Object>> spots = jdbcTemplate.queryForList(sql);
            return ResponseEntity.ok(spots);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    /**
     * Check-In Form: Assign a parking slot to a vehicle
     */
    @PostMapping("/checkin")
    public ResponseEntity<?> checkIn(@RequestBody Map<String, String> request) {
        String licensePlate = request.get("licensePlate"); // Maps to vehicle_number
        String spotType = request.getOrDefault("spotType", "CAR"); // Maps to vehicle_type
        String gateId = request.getOrDefault("gateId", "G1");

        if (licensePlate == null || licensePlate.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "License plate is required"));
        }

        try {
            Map<String, Object> result = jdbcTemplate.execute(
                new CallableStatementCreator() {
                    @Override
                    public CallableStatement createCallableStatement(Connection con) throws SQLException {
                        CallableStatement cs = con.prepareCall("{call PROC_ISSUE_TICKET(?, ?, ?, ?, ?)}");
                        cs.setString(1, licensePlate);
                        cs.setString(2, spotType);
                        cs.setString(3, gateId);
                        cs.registerOutParameter(4, Types.VARCHAR); // p_ticket_id
                        cs.registerOutParameter(5, Types.VARCHAR); // p_slot_id
                        return cs;
                    }
                },
                new CallableStatementCallback<Map<String, Object>>() {
                    @Override
                    public Map<String, Object> doInCallableStatement(CallableStatement cs) throws SQLException {
                        cs.execute();
                        Map<String, Object> map = new HashMap<>();
                        map.put("transactionId", cs.getString(4)); // Maps to ticket_id
                        map.put("spotId", cs.getString(5)); // Maps to slot_id
                        return map;
                    }
                }
            );
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return handleOracleException(e);
        }
    }

    /**
     * Calculate Fee Preview: Calculate fee without checking out
     */
    @GetMapping("/checkout/fee")
    public ResponseEntity<?> calculateFee(@RequestParam("transactionId") String transactionId) {
        if (transactionId == null || transactionId.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Transaction ID is required"));
        }

        try {
            Double fee = jdbcTemplate.execute(
                new CallableStatementCreator() {
                    @Override
                    public CallableStatement createCallableStatement(Connection con) throws SQLException {
                        CallableStatement cs = con.prepareCall("{? = call FUNC_CALCULATE_FEE(?)}");
                        cs.registerOutParameter(1, Types.NUMERIC); // Return fee
                        cs.setString(2, transactionId);
                        return cs;
                    }
                },
                new CallableStatementCallback<Double>() {
                    @Override
                    public Double doInCallableStatement(CallableStatement cs) throws SQLException {
                        cs.execute();
                        return cs.getDouble(1);
                    }
                }
            );

            return ResponseEntity.ok(Collections.singletonMap("fee", fee));
        } catch (Exception e) {
            return handleOracleException(e);
        }
    }

    /**
     * Check-Out Form: Calculate fee and process checkout
     */
    @PostMapping("/checkout")
    public ResponseEntity<?> checkOut(@RequestBody Map<String, String> request) {
        String transactionId = request.get("transactionId"); // Maps to ticket_id
        String paymentMode = request.getOrDefault("paymentMode", "CREDIT_CARD");

        if (transactionId == null || transactionId.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Transaction ID is required"));
        }

        try {
            // Step 1: Calculate Fee
            Double fee = jdbcTemplate.execute(
                new CallableStatementCreator() {
                    @Override
                    public CallableStatement createCallableStatement(Connection con) throws SQLException {
                        CallableStatement cs = con.prepareCall("{? = call FUNC_CALCULATE_FEE(?)}");
                        cs.registerOutParameter(1, Types.NUMERIC); // Return fee
                        cs.setString(2, transactionId);
                        return cs;
                    }
                },
                new CallableStatementCallback<Double>() {
                    @Override
                    public Double doInCallableStatement(CallableStatement cs) throws SQLException {
                        cs.execute();
                        return cs.getDouble(1);
                    }
                }
            );

            // Step 2: Process Checkout
            jdbcTemplate.execute(
                new CallableStatementCreator() {
                    @Override
                    public CallableStatement createCallableStatement(Connection con) throws SQLException {
                        CallableStatement cs = con.prepareCall("{call PROC_PROCESS_CHECKOUT(?, ?, ?)}");
                        cs.setString(1, transactionId);
                        cs.setString(2, paymentMode);
                        cs.setDouble(3, fee);
                        return cs;
                    }
                },
                new CallableStatementCallback<Void>() {
                    @Override
                    public Void doInCallableStatement(CallableStatement cs) throws SQLException {
                        cs.execute();
                        return null;
                    }
                }
            );

            return ResponseEntity.ok(Collections.singletonMap("fee", fee));
        } catch (Exception e) {
            return handleOracleException(e);
        }
    }

    /**
     * Admin: Add new parking slots
     */
    @PostMapping("/spots/add")
    public ResponseEntity<?> addSpots(@RequestBody Map<String, Object> request) {
        try {
            int count = Integer.parseInt(request.getOrDefault("count", "1").toString());
            String spotType = request.getOrDefault("spotType", "CAR").toString();
            String floorId = request.getOrDefault("floorId", "F1").toString();

            for (int i = 0; i < count; i++) {
                String slotId = "S_" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
                // Random slot number between 100 and 999 for simplicity
                int slotNumber = 100 + (int)(Math.random() * 900);

                jdbcTemplate.update(
                    "INSERT INTO ParkingSlot (slot_id, floor_id, slot_number, slot_type, is_occupied) VALUES (?, ?, ?, ?, 'N')",
                    slotId, floorId, slotNumber, spotType
                );
            }

            return ResponseEntity.ok(Collections.singletonMap("message", count + " " + spotType + " slot(s) added successfully."));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    /**
     * Admin: Remove available parking slots
     */
    @DeleteMapping("/spots/remove")
    public ResponseEntity<?> removeSpots(@RequestBody Map<String, Object> request) {
        try {
            if (request.containsKey("spotId") && request.get("spotId") != null && !request.get("spotId").toString().isEmpty()) {
                String spotId = request.get("spotId").toString();
                int removed = jdbcTemplate.update("DELETE FROM ParkingSlot WHERE slot_id = ? AND is_occupied = 'N'", spotId);

                if (removed == 0) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body(Collections.singletonMap("error", "Slot " + spotId + " cannot be removed (it may be occupied or does not exist)."));
                }
                return ResponseEntity.ok(Collections.singletonMap("message", "Slot " + spotId + " removed successfully."));
            }

            int count = Integer.parseInt(request.getOrDefault("count", "1").toString());

            String sql = "DELETE FROM ParkingSlot WHERE slot_id IN (" +
                         "SELECT p.slot_id FROM ParkingSlot p " +
                         "LEFT JOIN TICKET t ON p.slot_id = t.slot_id " +
                         "WHERE p.is_occupied = 'N' AND t.ticket_id IS NULL " +
                         "FETCH FIRST ? ROWS ONLY)";
            int removed = jdbcTemplate.update(sql, count);

            if (removed < count) {
                return ResponseEntity.ok(Collections.singletonMap("message", "Removed " + removed + " slots (not enough empty slots to remove exactly " + count + ")."));
            }
            return ResponseEntity.ok(Collections.singletonMap("message", removed + " slot(s) removed successfully."));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    /**
     * Admin: Add new floor
     */
    @PostMapping("/floors/add")
    public ResponseEntity<?> addFloor(@RequestBody Map<String, Object> request) {
        try {
            String lotId = request.getOrDefault("lotId", "L1").toString();
            int floorNumber = Integer.parseInt(request.getOrDefault("floorNumber", "1").toString());
            String floorId = "F_" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

            jdbcTemplate.update(
                "INSERT INTO FLOOR (floor_id, lot_id, floor_number) VALUES (?, ?, ?)",
                floorId, lotId, floorNumber
            );

            return ResponseEntity.ok(Collections.singletonMap("message", "Floor " + floorNumber + " added successfully."));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    /**
     * Admin: Add new gate
     */
    @PostMapping("/gates/add")
    public ResponseEntity<?> addGate(@RequestBody Map<String, Object> request) {
        try {
            String lotId = request.getOrDefault("lotId", "L1").toString();
            String gateType = request.getOrDefault("gateType", "ENTRY").toString();
            String gateId = "G_" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

            jdbcTemplate.update(
                "INSERT INTO GATE (gate_id, lot_id, gate_type) VALUES (?, ?, ?)",
                gateId, lotId, gateType
            );

            return ResponseEntity.ok(Collections.singletonMap("message", "Gate (" + gateType + ") added successfully."));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    /**
     * Search Spots by different criteria
     */
    @GetMapping("/spots/search")
    public ResponseEntity<?> searchSpots(
            @RequestParam(required = false) String spotId,
            @RequestParam(required = false) String spotType,
            @RequestParam(required = false) String licensePlate) {

        try {
            StringBuilder sql = new StringBuilder(
                "SELECT p.slot_id as \"spotId\", p.slot_type as \"spotType\", " +
                "p.is_occupied as \"isOccupied\", v.vehicle_number as \"licensePlate\", " +
                "t.ticket_id as \"transactionId\" " +
                "FROM ParkingSlot p " +
                "LEFT JOIN TICKET t ON p.slot_id = t.slot_id AND t.status = 'ACTIVE' " +
                "LEFT JOIN VEHICLE v ON t.vehicle_id = v.vehicle_id " +
                "WHERE 1=1 "
            );

            List<Object> params = new ArrayList<>();

            if (spotId != null && !spotId.trim().isEmpty()) {
                sql.append("AND UPPER(p.slot_id) LIKE UPPER(?) ");
                params.add("%" + spotId + "%");
            }
            if (spotType != null && !spotType.trim().isEmpty()) {
                sql.append("AND UPPER(p.slot_type) LIKE UPPER(?) ");
                params.add("%" + spotType + "%");
            }
            if (licensePlate != null && !licensePlate.trim().isEmpty()) {
                sql.append("AND UPPER(v.vehicle_number) LIKE UPPER(?) ");
                params.add("%" + licensePlate + "%");
            }

            sql.append("ORDER BY p.slot_id");

            List<Map<String, Object>> results = jdbcTemplate.queryForList(sql.toString(), params.toArray());
            return ResponseEntity.ok(results);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    /**
     * Helper to extract the friendly message from Oracle RAISE_APPLICATION_ERROR
     */
    private ResponseEntity<Map<String, String>> handleOracleException(Exception e) {
        String message = e.getMessage();
        // Extract the custom Oracle error message (e.g., ORA-20001: Parking lot is full)
        if (message != null && message.contains("ORA-20")) {
            int startIndex = message.indexOf("ORA-20");
            int endIndex = message.indexOf("\n", startIndex);
            if (endIndex == -1) endIndex = message.length();
            String cleanMessage = message.substring(startIndex, endIndex);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Collections.singletonMap("error", cleanMessage));
        }
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Collections.singletonMap("error", message != null ? message : "An unexpected database error occurred."));
    }
}
