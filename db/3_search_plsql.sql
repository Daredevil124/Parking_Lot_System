-- Procedure to search for a specific Spot ID
CREATE OR REPLACE PROCEDURE SearchBySpotID (
    p_SpotID IN NUMBER,
    p_ResultSet OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_ResultSet FOR
        SELECT p.SpotID as "spotId", p.SpotType as "spotType",
               p.IsOccupied as "isOccupied", t.LicensePlate as "licensePlate",
               t.TransactionID as "transactionId"
        FROM ParkingSpots p
        LEFT JOIN Transactions t ON p.SpotID = t.SpotID AND t.ExitTime IS NULL
        WHERE p.SpotID = p_SpotID
        ORDER BY p.SpotID;
END;
/

-- Procedure to search by Spot Type (supports partial matches)
CREATE OR REPLACE PROCEDURE SearchBySpotType (
    p_SpotType IN VARCHAR2,
    p_ResultSet OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_ResultSet FOR
        SELECT p.SpotID as "spotId", p.SpotType as "spotType",
               p.IsOccupied as "isOccupied", t.LicensePlate as "licensePlate",
               t.TransactionID as "transactionId"
        FROM ParkingSpots p
        LEFT JOIN Transactions t ON p.SpotID = t.SpotID AND t.ExitTime IS NULL
        WHERE UPPER(p.SpotType) LIKE '%' || UPPER(p_SpotType) || '%'
        ORDER BY p.SpotID;
END;
/

-- Procedure to search by Vehicle License Plate (supports partial matches)
CREATE OR REPLACE PROCEDURE SearchByLicensePlate (
    p_LicensePlate IN VARCHAR2,
    p_ResultSet OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_ResultSet FOR
        SELECT p.SpotID as "spotId", p.SpotType as "spotType",
               p.IsOccupied as "isOccupied", t.LicensePlate as "licensePlate",
               t.TransactionID as "transactionId"
        FROM ParkingSpots p
        JOIN Transactions t ON p.SpotID = t.SpotID AND t.ExitTime IS NULL
        WHERE UPPER(t.LicensePlate) LIKE '%' || UPPER(p_LicensePlate) || '%'
        ORDER BY p.SpotID;
END;
/
