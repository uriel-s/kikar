// AllUsers.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import UserCard from "../Components/UserCard";
import { useAuth } from "../contexts/AuthContext";
import { apiUrl } from '../Global/config';
const filterUsers = (users, filter, friendsList) => {
  if (filter === "friends") return users.filter(user => friendsList[user.id]);
  if (filter === "non-friends") return users.filter(user => !friendsList[user.id]);
  return users;
};

const AllUsers = () => {
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState("all");
    const [friendsList, setFriendsList] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const { currentUser } = useAuth();

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [usersRes, friendsRes] = await Promise.all([
                    axios.get(`${apiUrl}/users`),
                    axios.get(`${apiUrl}/users/${currentUser.uid}/friends`)
                ]);
  
                const friends = {};
                friendsRes.data.friends.forEach(friendId => friends[friendId] = true);
                
                setUsers(usersRes.data);
                setFriendsList(friends);
                setFilteredUsers(filterUsers(usersRes.data, filter, friends));
            } catch (error) {
                console.error("Error fetching data:", error);
                setError("Failed to load data. Please try again later.");
            } finally {
                setIsLoading(false);
            }
        };

        if (currentUser?.uid) {
            fetchData();
        }
    }, [currentUser?.uid, filter]);

    const handleFriendChange = async (friendId, action) => {
        try {
            if (action === 'add') {
                await axios.post(`${apiUrl}/users/${currentUser.uid}/friends`, { friendId });
            } else if (action === 'remove') {
                await axios.delete(`${apiUrl}/users/${currentUser.uid}/friends/${friendId}`);
            }

            const updatedFriendsRes = await axios.get(`${apiUrl}/users/${currentUser.uid}/friends`);
            const updatedFriends = {};
            updatedFriendsRes.data.friends.forEach(friendId => updatedFriends[friendId] = true);
            
            setFriendsList(updatedFriends);
            setFilteredUsers(filterUsers(users, filter, updatedFriends));
        } catch (error) {
            console.error("Error updating friend:", error);
            setError(action === 'add' ? "Failed to add friend" : "Failed to remove friend");
        }
    };

    if (isLoading) {
        return <div className="loading">Loading users...</div>;
    }

    return (
        <div className="mt6">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="filter-container">
                <label htmlFor="user-filter" className="filter-label">Filter users by:</label>
                <select
                    id="user-filter"
                    className="filter-select"
                    onChange={(e) => setFilter(e.target.value)}
                    value={filter}
                >
                    <option value="all">All</option>
                    <option value="friends">Friends</option>
                    <option value="non-friends">Non-friends</option>
                </select>
            </div>

            <div className="user-card-container  ">
                {filteredUsers.map(user => (
                    <UserCard 
                        key={user.id}
                        user={user}
                        isFriend={friendsList[user.id]}
                        onFriendChange={handleFriendChange}
                    />
                ))}
            </div>
        </div>
    );
};
export default AllUsers;