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

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*") // Allow frontend to connect
public class ParkingController {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * Dashboard View: Get total available spots
     */
    @GetMapping("/spots/available")
    public ResponseEntity<?> getAvailableSpots() {
        try {
            String sql = "SELECT COUNT(*) FROM ParkingSpots WHERE IsOccupied = 'N'";
            Integer count = jdbcTemplate.queryForObject(sql, Integer.class);
            return ResponseEntity.ok(Collections.singletonMap("availableSpots", count != null ? count : 0));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    /**
     * Dashboard View: Get all spots and their current status (with vehicle license plate if occupied)
     */
    @GetMapping("/spots")
    public ResponseEntity<?> getAllSpots() {
        try {
            String sql = "SELECT p.SpotID as \"spotId\", p.SpotType as \"spotType\", " +
                         "p.IsOccupied as \"isOccupied\", t.LicensePlate as \"licensePlate\", " +
                         "t.TransactionID as \"transactionId\" " +
                         "FROM ParkingSpots p " +
                         "LEFT JOIN Transactions t ON p.SpotID = t.SpotID AND t.ExitTime IS NULL " +
                         "ORDER BY p.SpotID";
            List<Map<String, Object>> spots = jdbcTemplate.queryForList(sql);
            return ResponseEntity.ok(spots);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    /**
     * Check-In Form: Assign a parking spot to a vehicle
     */
    @PostMapping("/checkin")
    public ResponseEntity<?> checkIn(@RequestBody Map<String, String> request) {
        String licensePlate = request.get("licensePlate");
        String spotType = request.getOrDefault("spotType", "Regular");

        if (licensePlate == null || licensePlate.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "License plate is required"));
        }

        try {
            Map<String, Object> result = jdbcTemplate.execute(
                new CallableStatementCreator() {
                    @Override
                    public CallableStatement createCallableStatement(Connection con) throws SQLException {
                        CallableStatement cs = con.prepareCall("{call AssignParkingSpot(?, ?, ?, ?)}");
                        cs.setString(1, licensePlate);
                        cs.setString(2, spotType);
                        cs.registerOutParameter(3, Types.NUMERIC); // p_TransactionID
                        cs.registerOutParameter(4, Types.NUMERIC); // p_SpotID
                        return cs;
                    }
                },
                new CallableStatementCallback<Map<String, Object>>() {
                    @Override
                    public Map<String, Object> doInCallableStatement(CallableStatement cs) throws SQLException {
                        cs.execute();
                        Map<String, Object> map = new HashMap<>();
                        map.put("transactionId", cs.getLong(3));
                        map.put("spotId", cs.getLong(4));
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
     * Check-Out Form: Calculate fee and free the spot
     */
    @PostMapping("/checkout")
    public ResponseEntity<?> checkOut(@RequestBody Map<String, Long> request) {
        Long transactionId = request.get("transactionId");

        if (transactionId == null) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Transaction ID is required"));
        }

        try {
            Map<String, Object> result = jdbcTemplate.execute(
                new CallableStatementCreator() {
                    @Override
                    public CallableStatement createCallableStatement(Connection con) throws SQLException {
                        // Oracle function call syntax
                        CallableStatement cs = con.prepareCall("{? = call CalculateFee(?)}");
                        cs.registerOutParameter(1, Types.NUMERIC); // Return value (fee)
                        cs.setLong(2, transactionId);
                        return cs;
                    }
                },
                new CallableStatementCallback<Map<String, Object>>() {
                    @Override
                    public Map<String, Object> doInCallableStatement(CallableStatement cs) throws SQLException {
                        cs.execute();
                        Map<String, Object> map = new HashMap<>();
                        map.put("fee", cs.getDouble(1));
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
     * Admin: Add new parking spots
     */
    @PostMapping("/spots/add")
    public ResponseEntity<?> addSpots(@RequestBody Map<String, Object> request) {
        try {
            int count = Integer.parseInt(request.getOrDefault("count", "1").toString());
            String spotType = request.getOrDefault("spotType", "Regular").toString();

            for (int i = 0; i < count; i++) {
                jdbcTemplate.update("INSERT INTO ParkingSpots (SpotType, IsOccupied) VALUES (?, 'N')", spotType);
            }

            return ResponseEntity.ok(Collections.singletonMap("message", count + " " + spotType + " spot(s) added successfully."));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    /**
     * Admin: Remove available parking spots
     */
    @DeleteMapping("/spots/remove")
    public ResponseEntity<?> removeSpots(@RequestBody Map<String, Object> request) {
        try {
            if (request.containsKey("spotId") && request.get("spotId") != null && !request.get("spotId").toString().isEmpty()) {
                int spotId = Integer.parseInt(request.get("spotId").toString());
                int removed = jdbcTemplate.update("DELETE FROM ParkingSpots WHERE SpotID = ? AND IsOccupied = 'N'", spotId);

                if (removed == 0) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body(Collections.singletonMap("error", "Spot " + spotId + " cannot be removed (it may be occupied or does not exist)."));
                }
                return ResponseEntity.ok(Collections.singletonMap("message", "Spot " + spotId + " removed successfully."));
            }

            int count = Integer.parseInt(request.getOrDefault("count", "1").toString());

            String sql = "DELETE FROM ParkingSpots WHERE SpotID IN (" +
                         "SELECT SpotID FROM ParkingSpots WHERE IsOccupied = 'N' FETCH FIRST ? ROWS ONLY)";
            int removed = jdbcTemplate.update(sql, count);

            if (removed < count) {
                return ResponseEntity.ok(Collections.singletonMap("message", "Removed " + removed + " spots (not enough empty spots to remove exactly " + count + ")."));
            }
            return ResponseEntity.ok(Collections.singletonMap("message", removed + " spot(s) removed successfully."));
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
            @RequestParam(required = false) Integer spotId,
            @RequestParam(required = false) String spotType,
            @RequestParam(required = false) String licensePlate) {

        try {
            List<Map<String, Object>> results = jdbcTemplate.execute(
                new CallableStatementCreator() {
                    @Override
                    public CallableStatement createCallableStatement(Connection con) throws SQLException {
                        CallableStatement cs;
                        if (spotId != null) {
                            cs = con.prepareCall("{call SearchBySpotID(?, ?)}");
                            cs.setInt(1, spotId);
                            cs.registerOutParameter(2, Types.REF_CURSOR);
                        } else if (spotType != null && !spotType.trim().isEmpty()) {
                            cs = con.prepareCall("{call SearchBySpotType(?, ?)}");
                            cs.setString(1, spotType);
                            cs.registerOutParameter(2, Types.REF_CURSOR);
                        } else if (licensePlate != null && !licensePlate.trim().isEmpty()) {
                            cs = con.prepareCall("{call SearchByLicensePlate(?, ?)}");
                            cs.setString(1, licensePlate);
                            cs.registerOutParameter(2, Types.REF_CURSOR);
                        } else {
                            // Fallback if no valid search param
                            cs = con.prepareCall("{call SearchBySpotType(?, ?)}");
                            cs.setString(1, ""); // empty matches all in our LIKE clause
                            cs.registerOutParameter(2, Types.REF_CURSOR);
                        }
                        return cs;
                    }
                },
                new CallableStatementCallback<List<Map<String, Object>>>() {
                    @Override
                    public List<Map<String, Object>> doInCallableStatement(CallableStatement cs) throws SQLException {
                        cs.execute();
                        ResultSet rs = (ResultSet) cs.getObject(2);
                        List<Map<String, Object>> list = new ArrayList<>();
                        while (rs.next()) {
                            Map<String, Object> map = new HashMap<>();
                            map.put("spotId", rs.getInt("spotId"));
                            map.put("spotType", rs.getString("spotType"));
                            map.put("isOccupied", rs.getString("isOccupied"));
                            map.put("licensePlate", rs.getString("licensePlate"));
                            map.put("transactionId", rs.getLong("transactionId") == 0 ? null : rs.getLong("transactionId"));
                            list.add(map);
                        }
                        return list;
                    }
                }
            );
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
